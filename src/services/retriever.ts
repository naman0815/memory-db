import { storage } from './storage'
import { embed, cosineSimilarity, EMBEDDING_MODEL } from './embedder'
import type { Memory, RetrievedMemory } from '../types'

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
    const vector = await embed(m.text)
    await storage.updateMemory(m.id, {
      embedding: vector,
      embeddingModelVersion: EMBEDDING_MODEL,
    })
  }
}

export async function search(question: string): Promise<RetrievedMemory[]> {
  await embedPending()
  const queryVector = await embed(question)
  const all = await storage.getAllMemories()

  const scored: RetrievedMemory[] = []
  for (const memory of all) {
    if (!memory.embedding) continue
    const score = cosineSimilarity(queryVector, toFloat32(memory.embedding))
    if (score >= SCORE_THRESHOLD) scored.push({ memory, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, TOP_K)
}

// IndexedDB round-trips Float32Array fine in modern browsers, but guard
// against structured-clone edge cases returning plain arrays.
function toFloat32(v: Memory['embedding']): Float32Array {
  return v instanceof Float32Array ? v : new Float32Array(v as unknown as number[])
}
