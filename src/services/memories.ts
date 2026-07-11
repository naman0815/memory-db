import { storage } from './storage'
import { embed, EMBEDDING_MODEL } from './embedder'
import { enrichMemory } from './enrich'
import type { Memory, MemoryType } from '../types'
import { embedText } from '../types'

/** crypto.randomUUID is secure-context-only; fall back for plain-HTTP LAN testing. */
export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface SaveInput {
  text: string
  type?: MemoryType
  blob?: Blob
  url?: string
  fields?: Record<string, string>
  tags?: string[]
  /** OCR/PDF text/transcript if already extracted by the caller */
  extractedText?: string
}

/**
 * Save pipeline: durable local write first (instant), then embedding and
 * enrichment update the row in the background. Media goes to the blobs table.
 */
export async function saveMemory(input: SaveInput): Promise<Memory> {
  const memory: Memory = {
    id: uuid(),
    type: input.type ?? 'note',
    text: input.text.trim(),
    createdAt: Date.now(),
    tags: input.tags,
    url: input.url,
    fields: input.fields,
    extractedText: input.extractedText,
    synced: false,
  }

  if (input.blob) {
    memory.blobId = uuid()
    memory.mimeType = input.blob.type
    await storage.putBlob({ id: memory.blobId, blob: input.blob, mimeType: input.blob.type })
  }

  await storage.addMemory(memory)
  await storage.enqueueOutbox({ id: uuid(), memoryId: memory.id, op: 'upsert', attempts: 0 })

  void finishInBackground(memory)
  return memory
}

/**
 * Late-arriving extracted text (slow OCR/transcription) — merge it in and
 * re-run embedding + enrichment over the fuller content.
 */
export async function attachExtractedText(id: string, extractedText: string, caption?: string): Promise<void> {
  const memory = await storage.getMemory(id)
  if (!memory) return
  const updated = { ...memory, extractedText, caption: caption ?? memory.caption }
  await storage.updateMemory(id, { extractedText, caption: updated.caption })
  void finishInBackground(updated)
}

async function finishInBackground(memory: Memory): Promise<void> {
  try {
    const vector = await embed(embedText(memory))
    await storage.updateMemory(memory.id, {
      embedding: vector,
      embeddingModelVersion: EMBEDDING_MODEL,
    })
    const changes = await enrichMemory(memory)
    await storage.updateMemory(memory.id, changes)
  } catch {
    // embedPending() in the retriever retries embedding; enrichment is best-effort
  }
}

export async function deleteMemory(id: string): Promise<void> {
  const memory = await storage.getMemory(id)
  if (memory?.blobId) await storage.deleteBlob(memory.blobId)
  await storage.deleteMemory(id)
  await storage.enqueueOutbox({ id: uuid(), memoryId: id, op: 'delete', attempts: 0 })
}

export async function listMemories(): Promise<Memory[]> {
  return storage.getAllMemories()
}

export async function getBlobUrl(blobId: string): Promise<string | null> {
  const stored = await storage.getBlob(blobId)
  return stored ? URL.createObjectURL(stored.blob) : null
}

/** Ask the browser not to evict our data — critical on Safari/iOS. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist()
  }
  return false
}
