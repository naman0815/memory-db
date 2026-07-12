import * as chrono from 'chrono-node'
import type { ExtractedEntities, Memory, MemoryType } from '../types'
import { embedText } from '../types'
import { embed, cosineSimilarity } from './embedder'
import { storage } from './storage'
import { isEngineReady, quickComplete } from './generator'
import { extractTicketFields } from './ticketFields'

const AMOUNT_RE = /(?:₹|rs\.?|inr|\$|usd|€|eur)\s?[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s?(?:rupees|dollars|euros)/gi
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d/g
const URL_RE = /https?:\/\/[^\s)>\]]+/g

export function extractEntities(text: string): ExtractedEntities {
  const entities: ExtractedEntities = {}
  const dates = chrono.parse(text).map((r) => r.text)
  if (dates.length) entities.dates = dates
  const amounts = text.match(AMOUNT_RE)
  if (amounts) entities.amounts = amounts.map((a) => a.trim())
  const emails = text.match(EMAIL_RE)
  if (emails) entities.emails = emails
  const urls = text.match(URL_RE)
  if (urls) entities.urls = urls
  const phones = text
    .replace(URL_RE, '')
    .match(PHONE_RE)
  if (phones) entities.phones = phones.map((p) => p.trim()).filter((p) => p.replace(/\D/g, '').length >= 10)
  return entities
}

/**
 * Parses the memory's eventDate. Picking chrono's first match by text
 * position is wrong for OCR'd tickets: a bare time like "8:10 AM" often
 * appears before the actual date line ("Sun, 19 July") in the extracted
 * text, and chrono resolves a bare time relative to referenceDate — giving
 * "the next 8:10 AM after this was saved" instead of the ticket's real date.
 * So: prefer the match that actually specifies day+month for the date, and
 * separately borrow the hour/minute from a bare-time match if the
 * date-bearing match didn't include its own time.
 */
export function extractEventDate(text: string, referenceDate = new Date()): number | undefined {
  const results = chrono.parse(text, referenceDate, { forwardDate: true })
  if (!results.length) return undefined

  // Ranked fallback: a full day+month is best; a month alone (e.g. OCR
  // dropped just the day number) still beats a bare time-only match, which
  // is the one most likely to silently resolve to the wrong date entirely.
  const dateResult =
    results.find((r) => r.start.isCertain('day') && r.start.isCertain('month')) ??
    results.find((r) => r.start.isCertain('month')) ??
    results[0]
  const timeResult = results.find((r) => r.start.isCertain('hour'))

  const date = dateResult.start.date()
  if (timeResult && timeResult !== dateResult && !dateResult.start.isCertain('hour')) {
    const t = timeResult.start.date()
    date.setHours(t.getHours(), t.getMinutes(), 0, 0)
  }
  return date.getTime()
}

const TICKET_WORDS = /\b(ticket|seat|screen|showtime|admit|pnr|boarding|gate|booking\s?id|confirmation)\b/i
const EVENT_WORDS = /\b(meeting|appointment|concert|event|deadline|due|expires?|expiry|renewal)\b/i
const RECEIPT_WORDS = /\b(receipt|invoice|total|paid|amount|order\s?#?|gst)\b/i

/** Heuristic categorization; the LLM refines it when loaded. */
export function categorize(text: string, base: MemoryType): MemoryType {
  if (base === 'image' || base === 'screenshot') {
    if (TICKET_WORDS.test(text)) return 'ticket'
    return base
  }
  if (base === 'note') {
    if (TICKET_WORDS.test(text)) return 'ticket'
    if (EVENT_WORDS.test(text) && chrono.parse(text).length) return 'event'
    if (URL_RE.test(text) && text.trim().split(/\s+/).length <= 8) return 'link'
  }
  if (base === 'pdf' && RECEIPT_WORDS.test(text) && TICKET_WORDS.test(text)) return 'ticket'
  return base
}

const STOPWORDS = new Set(
  'the a an is are was were be been i my me our we you your it its this that of in on at to for with and or from by as have has had do did not no'.split(' '),
)

/** Keyword fallback tags; LLM tags replace these when the engine is loaded. */
export function heuristicTags(text: string): string[] {
  const freq = new Map<string, number>()
  for (const word of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (!STOPWORDS.has(word)) freq.set(word, (freq.get(word) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w)
}

/**
 * Deterministic category tags for OCR'd/structured content — tickets,
 * receipts, bookings and the like. Fixes the actual complaint: raw OCR
 * text on a ticket ("BOOKING ID WKBK742", seat codes "J8, J9, J10") was
 * feeding the LLM tagger short numeric/coded fragments that got tagged
 * verbatim ("#1-3"), which are meaningless as tags. These patterns pull
 * out the human-meaningful category words instead ("ticket", "movie",
 * "booking"), and take priority over the LLM/heuristic fallback.
 */
const CONTENT_TAG_PATTERNS: [RegExp, string][] = [
  [/\b(tickets?|admit\s?one)\b/i, 'ticket'],
  [/\b(cinemas?|cinepolis|multiplex|\bpvr\b|inox|imax|movies?|films?)\b/i, 'movie'],
  [/\bbookings?\b/i, 'booking'],
  [/\b(flights?|boarding\s?pass|airlines?|airports?)\b/i, 'flight'],
  [/\b(hotels?|check-?in|check-?out|reservations?)\b/i, 'hotel'],
  [/\b(concerts?|festivals?|\bgigs?\b)\b/i, 'concert'],
  [/\b(receipts?|invoices?|\bgst\b|total\s?amount)\b/i, 'receipt'],
  [/\b(appointments?|clinics?|doctors?|prescriptions?)\b/i, 'appointment'],
  [/\b(trains?|railway|\birctc\b)\b/i, 'train'],
  [/\bevents?\b/i, 'event'],
]

export function contentCategoryTags(text: string): string[] {
  const tags: string[] = []
  for (const [re, tag] of CONTENT_TAG_PATTERNS) {
    if (re.test(text) && !tags.includes(tag)) tags.push(tag)
  }
  return tags.slice(0, 4)
}

export async function llmTags(text: string): Promise<string[] | null> {
  if (!isEngineReady()) return null
  try {
    const out = await quickComplete(
      `Suggest 2-4 short lowercase tags (single words or hyphenated) for this personal memory. Reply with ONLY the tags, comma-separated.\n\nMemory: ${text.slice(0, 500)}`,
    )
    const tags = out
      .split(/[,\n]/)
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
      // No digits — a real tag is a word, not an OCR'd code/number/range
      // (this is exactly what let '#1-3' through before).
      .filter((t) => t.length > 1 && t.length < 25 && !/\d/.test(t))
      .slice(0, 4)
    return tags.length ? tags : null
  } catch {
    return null
  }
}

const DUPLICATE_THRESHOLD = 0.92

/** Returns the most similar existing memory if it looks like a duplicate. */
export async function findDuplicate(text: string): Promise<{ memory: Memory; score: number } | null> {
  const vector = await embed(text)
  let best: { memory: Memory; score: number } | null = null
  for (const memory of await storage.getAllMemories()) {
    if (!memory.embedding) continue
    const emb = memory.embedding instanceof Float32Array ? memory.embedding : new Float32Array(memory.embedding as unknown as number[])
    const score = cosineSimilarity(vector, emb)
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) best = { memory, score }
  }
  return best
}

/** Full enrichment applied to a saved memory (runs in background). */
export async function enrichMemory(memory: Memory): Promise<Partial<Memory>> {
  const searchable = embedText(memory)
  const changes: Partial<Memory> = {}
  changes.entities = extractEntities(searchable)
  const eventDate = extractEventDate(searchable, new Date(memory.createdAt))
  if (eventDate) changes.eventDate = eventDate
  changes.type = categorize(searchable, memory.type)
  if (!memory.fields && memory.extractedText) {
    const fields = extractTicketFields(memory.extractedText)
    if (fields) changes.fields = fields
  }
  if (!memory.tags?.length) {
    const contentTags = contentCategoryTags(searchable)
    const fallbackTags = (await llmTags(searchable)) ?? heuristicTags(searchable)
    changes.tags = [...contentTags, ...fallbackTags.filter((t) => !contentTags.includes(t))].slice(0, 4)
  }
  if (!memory.category) {
    const tags = changes.tags ?? memory.tags
    changes.category = tags?.[0] ? titleCase(tags[0]) : 'General'
  }
  return changes
}

function titleCase(s: string): string {
  return s.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase())
}
