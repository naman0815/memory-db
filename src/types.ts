export interface Memory {
  id: string
  text: string
  createdAt: number
  tags?: string[]
  /** 384-dim vector from the embedding model; undefined until embedded */
  embedding?: Float32Array
  /** Model that produced the embedding — mismatch triggers re-embed */
  embeddingModelVersion?: string
  synced: boolean
  deletedAt?: number
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
