import Dexie, { type Table } from 'dexie'
import type { Memory, OutboxEntry, StoredBlob } from '../types'

/**
 * Storage abstraction so a future multi-device sync backend can be swapped in
 * without touching the retrieval/generation pipeline.
 */
export interface StorageAdapter {
  addMemory(memory: Memory): Promise<void>
  updateMemory(id: string, changes: Partial<Memory>): Promise<void>
  deleteMemory(id: string): Promise<void>
  getMemory(id: string): Promise<Memory | undefined>
  getAllMemories(): Promise<Memory[]>
  enqueueOutbox(entry: OutboxEntry): Promise<void>
  getOutbox(): Promise<OutboxEntry[]>
  removeOutbox(id: string): Promise<void>
  updateOutbox(id: string, changes: Partial<OutboxEntry>): Promise<void>
  putBlob(stored: StoredBlob): Promise<void>
  getBlob(id: string): Promise<StoredBlob | undefined>
  deleteBlob(id: string): Promise<void>
}

class MemoryDatabase extends Dexie {
  memories!: Table<Memory, string>
  syncOutbox!: Table<OutboxEntry, string>
  blobs!: Table<StoredBlob, string>

  constructor() {
    super('memory-db')
    this.version(1).stores({
      memories: 'id, createdAt, synced',
      syncOutbox: 'id, memoryId',
    })
    this.version(2)
      .stores({
        memories: 'id, createdAt, synced, type, eventDate',
        syncOutbox: 'id, memoryId',
        blobs: 'id',
      })
      .upgrade((tx) =>
        tx.table('memories').toCollection().modify((m: Memory) => {
          if (!m.type) m.type = 'note'
        }),
      )
  }
}

export class DexieStorage implements StorageAdapter {
  private db = new MemoryDatabase()

  async addMemory(memory: Memory): Promise<void> {
    await this.db.memories.add(memory)
  }

  async updateMemory(id: string, changes: Partial<Memory>): Promise<void> {
    await this.db.memories.update(id, changes)
  }

  async deleteMemory(id: string): Promise<void> {
    // Tombstone rather than hard delete so the deletion can sync to backup
    await this.db.memories.update(id, { deletedAt: Date.now(), synced: false })
  }

  async getMemory(id: string): Promise<Memory | undefined> {
    return this.db.memories.get(id)
  }

  async getAllMemories(): Promise<Memory[]> {
    const all = await this.db.memories.orderBy('createdAt').reverse().toArray()
    return all.filter((m) => !m.deletedAt)
  }

  async enqueueOutbox(entry: OutboxEntry): Promise<void> {
    await this.db.syncOutbox.put(entry)
  }

  async getOutbox(): Promise<OutboxEntry[]> {
    return this.db.syncOutbox.toArray()
  }

  async removeOutbox(id: string): Promise<void> {
    await this.db.syncOutbox.delete(id)
  }

  async updateOutbox(id: string, changes: Partial<OutboxEntry>): Promise<void> {
    await this.db.syncOutbox.update(id, changes)
  }

  async putBlob(stored: StoredBlob): Promise<void> {
    await this.db.blobs.put(stored)
  }

  async getBlob(id: string): Promise<StoredBlob | undefined> {
    return this.db.blobs.get(id)
  }

  async deleteBlob(id: string): Promise<void> {
    await this.db.blobs.delete(id)
  }
}

export const storage: StorageAdapter = new DexieStorage()
