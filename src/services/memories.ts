import { storage } from './storage'
import { embed, EMBEDDING_MODEL } from './embedder'
import type { Memory } from '../types'

/** crypto.randomUUID is secure-context-only; fall back for plain-HTTP LAN testing. */
export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Save pipeline: local write first (instant), then embedding + sync are
 * layered on in later phases without blocking this path.
 */
export async function saveMemory(text: string, tags?: string[]): Promise<Memory> {
  const memory: Memory = {
    id: uuid(),
    text: text.trim(),
    createdAt: Date.now(),
    tags,
    synced: false,
  }
  await storage.addMemory(memory)
  // Embed in the background — the local write is already durable, and
  // embedPending() in the retriever catches anything that fails here.
  embed(memory.text)
    .then((vector) =>
      storage.updateMemory(memory.id, {
        embedding: vector,
        embeddingModelVersion: EMBEDDING_MODEL,
      }),
    )
    .catch(() => {})
  await storage.enqueueOutbox({
    id: uuid(),
    memoryId: memory.id,
    op: 'upsert',
    attempts: 0,
  })
  return memory
}

export async function deleteMemory(id: string): Promise<void> {
  await storage.deleteMemory(id)
  await storage.enqueueOutbox({
    id: uuid(),
    memoryId: id,
    op: 'delete',
    attempts: 0,
  })
}

export async function listMemories(): Promise<Memory[]> {
  return storage.getAllMemories()
}

/** Ask the browser not to evict our data — critical on Safari/iOS. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist()
  }
  return false
}
