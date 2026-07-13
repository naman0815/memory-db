import { storage } from './storage'
import { embed, EMBED_CONTENT_VERSION } from './embedder'
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
  category?: string
  /** OCR/PDF text/transcript if already extracted by the caller */
  extractedText?: string
}

/**
 * Save pipeline: durable local write first (instant), then embedding and
 * enrichment update the row in the background. Media goes to the blobs table.
 *
 * onEnriched, if given, fires once background enrichment (tags, category,
 * eventDate, embedding) actually lands in storage — callers that show a
 * memories list should re-fetch then, not just after the initial save.
 * Plain-text notes (no attached file) have no other point where the UI
 * would naturally refresh again, so without this the list silently goes
 * stale: it shows the pre-enrichment snapshot until some unrelated action
 * (like adding another memory) happens to trigger a refetch.
 */
export async function saveMemory(input: SaveInput, onEnriched?: () => void): Promise<Memory> {
  const memory: Memory = {
    id: uuid(),
    type: input.type ?? 'note',
    text: input.text.trim(),
    createdAt: Date.now(),
    tags: input.tags,
    category: input.category,
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

  finishInBackground(memory).then(onEnriched)
  return memory
}

/**
 * Late-arriving extracted text (slow OCR/transcription) — merge it in and
 * re-run embedding + enrichment over the fuller content.
 */
export async function attachExtractedText(
  id: string,
  extractedText: string,
  onEnriched?: () => void,
): Promise<void> {
  const memory = await storage.getMemory(id)
  if (!memory) return
  const updated = { ...memory, extractedText }
  await storage.updateMemory(id, { extractedText })
  finishInBackground(updated).then(onEnriched)
}

async function finishInBackground(memory: Memory): Promise<void> {
  try {
    // Enrich first (tags, fields, etc.) so the embedding below is computed
    // from embedText() with tags already present — otherwise tags added by
    // enrichMemory would never make it into the vector at all.
    const changes = await enrichMemory(memory)
    const enriched = { ...memory, ...changes }
    const vector = await embed(embedText(enriched))
    await storage.updateMemory(memory.id, {
      ...changes,
      embedding: vector,
      embeddingModelVersion: EMBED_CONTENT_VERSION,
    })
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

export async function getMemoryById(id: string): Promise<Memory | undefined> {
  return storage.getMemory(id)
}

/**
 * Shared apply step for user-initiated edits (typo/OCR-mistake corrections).
 * Only re-embeds — doesn't re-run enrichMemory, since tags/category/eventDate
 * were likely already set (by the user or by enrichment) and a wording tweak
 * shouldn't silently reclassify or re-tag an entry the user has already curated.
 */
async function applyMemoryEdit(id: string, patch: Partial<Memory>, onUpdated?: () => void): Promise<void> {
  const memory = await storage.getMemory(id)
  if (!memory) return
  const updated = { ...memory, ...patch }
  await storage.updateMemory(id, { ...patch, synced: false })
  await storage.enqueueOutbox({ id: uuid(), memoryId: id, op: 'upsert', attempts: 0 })
  try {
    const vector = await embed(embedText(updated))
    await storage.updateMemory(id, { embedding: vector, embeddingModelVersion: EMBED_CONTENT_VERSION })
  } catch {
    // embedPending() retries later
  }
  onUpdated?.()
}

export async function updateMemoryText(id: string, text: string, onUpdated?: () => void): Promise<void> {
  return applyMemoryEdit(id, { text: text.trim() }, onUpdated)
}

/** User-initiated edit of structured fields (e.g. a ticket's Booking ID/Screen/Seats). */
export async function updateMemoryFields(
  id: string,
  fields: Record<string, string>,
  onUpdated?: () => void,
): Promise<void> {
  return applyMemoryEdit(id, { fields }, onUpdated)
}

/**
 * User-initiated edit of OCR/PDF-extracted raw text — labelOf() falls back
 * to this for the tile title only when a memory has no text or caption, so
 * setting a caption (see updateMemoryCaption) is the more direct way to fix
 * a garbled title.
 */
export async function updateMemoryExtractedText(id: string, extractedText: string, onUpdated?: () => void): Promise<void> {
  return applyMemoryEdit(id, { extractedText: extractedText.trim() }, onUpdated)
}

/** User-initiated edit of the short display title (memory.caption) — the label
 *  shown on tiles/cards when a memory has no memory.text (e.g. a scanned ticket). */
export async function updateMemoryCaption(id: string, caption: string, onUpdated?: () => void): Promise<void> {
  return applyMemoryEdit(id, { caption: caption.trim() || undefined }, onUpdated)
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
