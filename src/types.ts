export type MemoryType =
  | 'note'
  | 'image'
  | 'screenshot'
  | 'ticket'
  | 'event'
  | 'pdf'
  | 'audio'
  | 'link'
  | 'contact'
  | 'fact'

export interface ExtractedEntities {
  dates?: string[]
  amounts?: string[]
  emails?: string[]
  phones?: string[]
  urls?: string[]
}

export interface Memory {
  id: string
  type: MemoryType
  /** User-entered text (caption/note for media, body for notes) */
  text: string
  createdAt: number
  tags?: string[]
  /** Freeform user topic/folder shown in Home ("Bali Trip 2026", "Health"); distinct from type/tags */
  category?: string
  /** 384-dim vector over embedText(); undefined until embedded */
  embedding?: Float32Array
  /** Model that produced the embedding — mismatch triggers re-embed */
  embeddingModelVersion?: string
  synced: boolean
  deletedAt?: number

  /** Media blob reference (blobs table) */
  blobId?: string
  mimeType?: string
  /** OCR text, PDF text, or audio transcript */
  extractedText?: string
  /** AI-generated image caption */
  caption?: string
  /** Parsed event/expiry date (tickets, events, deadlines) */
  eventDate?: number
  entities?: ExtractedEntities
  url?: string
  /** Structured fields for contacts / templated facts */
  fields?: Record<string, string>
}

export interface StoredBlob {
  id: string
  blob: Blob
  mimeType: string
}

export interface OutboxEntry {
  id: string
  memoryId: string
  op: 'upsert' | 'delete'
  attempts: number
  lastTriedAt?: number
}

export interface RetrievedMemory {
  memory: Memory
  score: number
}

/** All searchable text of a memory, used as embedding input. */
export function embedText(m: Pick<Memory, 'text' | 'extractedText' | 'caption' | 'fields' | 'url' | 'type'>): string {
  const parts = [m.text]
  if (m.caption) parts.push(m.caption)
  if (m.extractedText) parts.push(m.extractedText)
  if (m.url) parts.push(m.url)
  if (m.fields) parts.push(Object.entries(m.fields).map(([k, v]) => `${k}: ${v}`).join('; '))
  return parts.filter(Boolean).join('\n').slice(0, 2000)
}
