import { storage } from './storage'
import type { Memory } from '../types'

/**
 * Save pipeline: local write first (instant), then embedding + sync are
 * layered on in later phases without blocking this path.
 */
export async function saveMemory(text: string, tags?: string[]): Promise<Memory> {
  const memory: Memory = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: Date.now(),
    tags,
    synced: false,
  }
  await storage.addMemory(memory)
  await storage.enqueueOutbox({
    id: crypto.randomUUID(),
    memoryId: memory.id,
    op: 'upsert',
    attempts: 0,
  })
  return memory
}

export async function deleteMemory(id: string): Promise<void> {
  await storage.deleteMemory(id)
  await storage.enqueueOutbox({
    id: crypto.randomUUID(),
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
