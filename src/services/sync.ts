import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { storage } from './storage'
import type { Memory } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const syncConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!syncConfigured) throw new Error('Supabase not configured')
  if (!client) client = createClient(url!, anonKey!)
  return client
}

export async function getSession(): Promise<Session | null> {
  if (!syncConfigured) return null
  const { data } = await getSupabase().auth.getSession()
  return data.session
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut()
}

let flushing = false

/**
 * Push everything in the outbox to Supabase. Safe to call often — no-ops
 * when offline, signed out, unconfigured, or already flushing. Entries stay
 * queued until the server confirms, so nothing is lost on failure.
 */
export async function flushOutbox(): Promise<void> {
  if (!syncConfigured || flushing || !navigator.onLine) return
  const session = await getSession()
  if (!session) return

  flushing = true
  try {
    const supabase = getSupabase()
    for (const entry of await storage.getOutbox()) {
      const memory = await storage.getMemory(entry.memoryId)
      if (!memory) {
        await storage.removeOutbox(entry.id)
        continue
      }
      const { error } = await supabase.from('memories').upsert({
        id: memory.id,
        text: memory.text,
        created_at: new Date(memory.createdAt).toISOString(),
        tags: memory.tags ?? null,
        deleted_at: memory.deletedAt ? new Date(memory.deletedAt).toISOString() : null,
      })
      if (error) {
        await storage.updateOutbox(entry.id, {
          attempts: entry.attempts + 1,
          lastTriedAt: Date.now(),
        })
        break // server unreachable or rejecting — retry the batch later
      }
      await storage.removeOutbox(entry.id)
      await storage.updateMemory(memory.id, { synced: true })
    }
  } finally {
    flushing = false
  }
}

/** Pull all backed-up memories into the local store (embeddings recomputed locally). */
export async function restoreFromCloud(): Promise<number> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('memories')
    .select('id, text, created_at, tags, deleted_at')
    .is('deleted_at', null)
  if (error) throw error

  let restored = 0
  for (const row of data ?? []) {
    if (await storage.getMemory(row.id)) continue
    const memory: Memory = {
      id: row.id,
      text: row.text,
      createdAt: new Date(row.created_at).getTime(),
      tags: row.tags ?? undefined,
      synced: true,
    }
    await storage.addMemory(memory)
    restored++
  }
  return restored
}

/** Wire up automatic flushing: on reconnect and on a slow heartbeat. */
export function startAutoSync(): void {
  if (!syncConfigured) return
  window.addEventListener('online', () => void flushOutbox())
  setInterval(() => void flushOutbox(), 60_000)
  void flushOutbox()
}
