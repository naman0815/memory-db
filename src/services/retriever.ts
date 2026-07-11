import * as chrono from 'chrono-node'
import { storage } from './storage'
import { embed, cosineSimilarity, EMBEDDING_MODEL } from './embedder'
import type { Memory, RetrievedMemory } from '../types'
import { embedText } from '../types'

const TOP_K = 5
const SCORE_THRESHOLD = 0.35

/**
 * Embed any memories that are missing a vector or were embedded with an
 * older model. Runs opportunistically before each search and after saves.
 */
export async function embedPending(): Promise<void> {
  const all = await storage.getAllMemories()
  const pending = all.filter(
    (m) => !m.embedding || m.embeddingModelVersion !== EMBEDDING_MODEL,
  )
  for (const m of pending) {
    const vector = await embed(embedText(m))
    await storage.updateMemory(m.id, {
      embedding: vector,
      embeddingModelVersion: EMBEDDING_MODEL,
    })
  }
}

interface DateRange {
  start: number
  end: number
}

/**
 * Pull a date range out of a question ("last week", "in March", "tomorrow").
 * Returns the question with the date phrase removed so the semantic part
 * matches on content, not on date words.
 */
export function parseTimeFilter(question: string): { rest: string; range: DateRange | null } {
  const results = chrono.parse(question)
  if (!results.length) return { rest: question, range: null }
  const r = results[0]
  const start = r.start.date()
  let end: Date
  if (r.end) {
    end = r.end.date()
  } else if (/week(?!end)/i.test(r.text)) {
    end = new Date(start)
    end.setDate(end.getDate() + 7)
  } else if (/weekend/i.test(r.text)) {
    end = new Date(start)
    end.setDate(end.getDate() + 2)
  } else if (!r.start.isCertain('day')) {
    end = new Date(start)
    end.setMonth(end.getMonth() + 1) // month-granularity phrase
  } else {
    end = new Date(start)
    end.setDate(end.getDate() + 1)
  }
  const rest = (question.slice(0, r.index) + question.slice(r.index + r.text.length)).trim()
  return { rest: rest || question, range: { start: start.getTime(), end: end.getTime() } }
}

function inRange(m: Memory, range: DateRange): boolean {
  const t = m.eventDate ?? m.createdAt
  return t >= range.start && t < range.end
}

export async function search(question: string): Promise<RetrievedMemory[]> {
  await embedPending()
  const { rest, range } = parseTimeFilter(question)
  const queryVector = await embed(rest)
  const all = await storage.getAllMemories()
  const candidates = range ? all.filter((m) => inRange(m, range)) : all

  const scored: RetrievedMemory[] = []
  for (const memory of candidates) {
    if (!memory.embedding) continue
    const score = cosineSimilarity(queryVector, toFloat32(memory.embedding))
    if (score >= SCORE_THRESHOLD) scored.push({ memory, score })
  }
  scored.sort((a, b) => b.score - a.score)
  // A pure time question ("what did I save last week?") may have no semantic
  // remainder that clears the threshold — fall back to everything in range.
  if (range && scored.length === 0) {
    return candidates
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, TOP_K * 2)
      .map((memory) => ({ memory, score: 0 }))
  }
  return scored.slice(0, TOP_K)
}

/** Top-N memories most similar to the given one (for "see also"). */
export async function relatedMemories(memory: Memory, count = 3): Promise<RetrievedMemory[]> {
  if (!memory.embedding) return []
  const source = toFloat32(memory.embedding)
  const all = await storage.getAllMemories()
  return all
    .filter((m) => m.id !== memory.id && m.embedding)
    .map((m) => ({ memory: m, score: cosineSimilarity(source, toFloat32(m.embedding!)) }))
    .filter((r) => r.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}

// IndexedDB round-trips Float32Array fine in modern browsers, but guard
// against structured-clone edge cases returning plain arrays.
function toFloat32(v: NonNullable<Memory['embedding']>): Float32Array {
  return v instanceof Float32Array ? v : new Float32Array(v as unknown as number[])
}
