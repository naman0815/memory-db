import Dexie, { type Table } from 'dexie'
import type { Memory, OutboxEntry } from '../types'

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
}

class MemoryDatabase extends Dexie {
  memories!: Table<Memory, string>
  syncOutbox!: Table<OutboxEntry, string>

  constructor() {
    super('memory-db')
    this.version(1).stores({
      memories: 'id, createdAt, synced',
      syncOutbox: 'id, memoryId',
    })
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
}

export const storage: StorageAdapter = new DexieStorage()
