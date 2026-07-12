import { storage } from './storage'
import type { Memory } from '../types'

const DAY = 24 * 60 * 60 * 1000
const DIGEST_KEY = 'last-digest-shown'

export interface Digest {
  upcoming: Memory[]
  /** Events/expiries within the next 3 days — surfaced separately since these need action soon. */
  expiringSoon: Memory[]
  recentCount: number
  totalCount: number
  topTags: string[]
}

/** Events/expiries in the next `days` days, soonest first. */
export async function upcomingMemories(days = 30): Promise<Memory[]> {
  const now = Date.now()
  const all = await storage.getAllMemories()
  return all
    .filter((m) => m.eventDate && m.eventDate >= now - DAY && m.eventDate <= now + days * DAY)
    .sort((a, b) => a.eventDate! - b.eventDate!)
}

export async function buildDigest(): Promise<Digest> {
  const all = await storage.getAllMemories()
  const weekAgo = Date.now() - 7 * DAY
  const recent = all.filter((m) => m.createdAt >= weekAgo)
  const tagCounts = new Map<string, number>()
  for (const m of recent) for (const t of m.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  return {
    upcoming: await upcomingMemories(),
    expiringSoon: await upcomingMemories(3),
    recentCount: recent.length,
    totalCount: all.length,
    topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t),
  }
}

/** Weekly digest is due if 7+ days since last shown. */
export function digestDue(): boolean {
  const last = Number(localStorage.getItem(DIGEST_KEY) ?? 0)
  return Date.now() - last >= 7 * DAY
}

export function markDigestShown(): void {
  localStorage.setItem(DIGEST_KEY, String(Date.now()))
}

/**
 * In-app reminders: fire a Notification for events in the next 24h when the
 * app opens. (True background push needs a server — future Supabase edge fn.)
 */
export async function notifyImminentEvents(): Promise<void> {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission !== 'granted') return
  const soon = (await upcomingMemories(1)).slice(0, 3)
  for (const m of soon) {
    new Notification('Upcoming', {
      body: `${new Date(m.eventDate!).toLocaleString()} — ${m.text || m.extractedText?.slice(0, 80) || m.type}`,
      tag: m.id, // dedupes repeat notifications for the same memory
    })
  }
}
