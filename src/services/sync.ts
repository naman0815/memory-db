import { storage } from './storage'
import { uuid } from './memories'
import type { Memory } from '../types'

const SYNC_CODE_KEY = 'sync-code'
const API = '/api/memories'

export const syncConfigured = true

export function getSyncCode(): string | null {
  return localStorage.getItem(SYNC_CODE_KEY)
}

/** Turns on backup for the first time on this device — one-time random secret, shown once. */
export function generateSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const code = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  localStorage.setItem(SYNC_CODE_KEY, code)
  return code
}

/** Links this device to an existing backup created elsewhere. */
export function setSyncCode(code: string): void {
  localStorage.setItem(SYNC_CODE_KEY, code.trim())
}

/** Forgets the code on this device only — does not delete the server-side backup. */
export function clearSyncCode(): void {
  localStorage.removeItem(SYNC_CODE_KEY)
}

function toRow(memory: Memory) {
  return {
    id: memory.id,
    text: memory.text,
    created_at: new Date(memory.createdAt).toISOString(),
    tags: memory.tags ?? null,
    deleted_at: memory.deletedAt ? new Date(memory.deletedAt).toISOString() : null,
    // Everything except the raw blob (media backup would need object storage — future)
    meta: {
      type: memory.type,
      category: memory.category ?? null,
      url: memory.url ?? null,
      fields: memory.fields ?? null,
      extractedText: memory.extractedText ?? null,
      caption: memory.caption ?? null,
      eventDate: memory.eventDate ?? null,
      entities: memory.entities ?? null,
      mimeType: memory.mimeType ?? null,
    },
  }
}

let flushing = false

/**
 * Push everything in the outbox to the backup API. Safe to call often —
 * no-ops when offline or no sync code is set. Entries stay queued until the
 * server confirms, so nothing is lost on failure.
 */
export async function flushOutbox(): Promise<void> {
  const syncCode = getSyncCode()
  if (!syncCode || flushing || !navigator.onLine) return

  flushing = true
  try {
    for (const entry of await storage.getOutbox()) {
      const memory = await storage.getMemory(entry.memoryId)
      if (!memory) {
        await storage.removeOutbox(entry.id)
        continue
      }
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ syncCode, memory: toRow(memory) }),
      })
      if (!res.ok) {
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

/**
 * Enqueues every existing local memory for push — needed the moment backup
 * is turned on. Without this, "Turn on backup" only affected memories saved
 * or edited from that point forward (saveMemory/updateMemory* are the only
 * places that normally call enqueueOutbox), so everything already in the
 * app before backup was enabled silently never made it to the server —
 * restoring on another device then pulled back little or nothing.
 */
export async function enqueueAllForSync(): Promise<number> {
  const memories = await storage.getAllMemories()
  for (const memory of memories) {
    await storage.enqueueOutbox({ id: uuid(), memoryId: memory.id, op: 'upsert', attempts: 0 })
  }
  return memories.length
}

/** Pull all backed-up memories into the local store (embeddings recomputed locally). */
export async function restoreFromCloud(): Promise<number> {
  const syncCode = getSyncCode()
  if (!syncCode) throw new Error('No sync code set on this device')

  const res = await fetch(`${API}?syncCode=${encodeURIComponent(syncCode)}`)
  if (!res.ok) throw new Error(`Restore failed: ${res.status}`)
  const { rows } = (await res.json()) as { rows: Record<string, any>[] }

  let restored = 0
  for (const row of rows) {
    if (await storage.getMemory(row.id)) continue
    const meta = row.meta ?? {}
    const memory: Memory = {
      id: row.id,
      type: meta.type ?? 'note',
      text: row.text,
      createdAt: new Date(row.created_at).getTime(),
      tags: row.tags ?? undefined,
      category: meta.category ?? undefined,
      url: meta.url ?? undefined,
      fields: meta.fields ?? undefined,
      extractedText: meta.extractedText ?? undefined,
      caption: meta.caption ?? undefined,
      eventDate: meta.eventDate ?? undefined,
      entities: meta.entities ?? undefined,
      synced: true,
    }
    await storage.addMemory(memory)
    restored++
  }
  return restored
}

/** Wire up automatic flushing: on reconnect and on a slow heartbeat. */
export function startAutoSync(): void {
  window.addEventListener('online', () => void flushOutbox())
  setInterval(() => void flushOutbox(), 60_000)
  void flushOutbox()
}
