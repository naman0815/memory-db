import { useEffect, useMemo, useState } from 'react'
import type { Memory, MemoryType } from '../types'
import { deleteMemory } from '../services/memories'
import { upcomingMemories, buildDigest, digestDue, markDigestShown, type Digest } from '../services/digest'
import { flushOutbox } from '../services/sync'
import { MemoryCard } from './MemoryCard'

export function BrowseTab({ memories, onChanged }: { memories: Memory[]; onChanged: () => void }) {
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<Memory[]>([])
  const [digest, setDigest] = useState<Digest | null>(null)

  useEffect(() => {
    upcomingMemories().then(setUpcoming)
    if (digestDue()) {
      buildDigest().then((d) => {
        setDigest(d)
        markDigestShown()
      })
    }
  }, [memories])

  const types = useMemo(() => [...new Set(memories.map((m) => m.type))], [memories])
  const tags = useMemo(() => [...new Set(memories.flatMap((m) => m.tags ?? []))].sort(), [memories])

  const filtered = memories.filter(
    (m) => (typeFilter === 'all' || m.type === typeFilter) && (!tagFilter || m.tags?.includes(tagFilter)),
  )

  const byDay = useMemo(() => {
    const groups = new Map<string, Memory[]>()
    for (const m of filtered) {
      const day = new Date(m.createdAt).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      if (!groups.has(day)) groups.set(day, [])
      groups.get(day)!.push(m)
    }
    return [...groups.entries()]
  }, [filtered])

  async function handleDelete(id: string) {
    await deleteMemory(id)
    onChanged()
    void flushOutbox()
  }

  return (
    <>
      {digest && (
        <div className="llm-banner">
          <p>
            📬 Weekly digest: {digest.recentCount} new memories this week ({digest.totalCount} total).
            {digest.topTags.length > 0 && ` Trending: ${digest.topTags.map((t) => `#${t}`).join(' ')}.`}
            {digest.upcoming.length > 0 && ` ${digest.upcoming.length} upcoming events.`}
          </p>
          <button className="mic" onClick={() => setDigest(null)}>
            Dismiss
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="memory-list">
          <h2>📅 Upcoming</h2>
          {upcoming.slice(0, 5).map((m) => (
            <p key={m.id} className="upcoming-item">
              <strong>{new Date(m.eventDate!).toLocaleString()}</strong> —{' '}
              {m.text || m.extractedText?.slice(0, 60) || m.type}
            </p>
          ))}
        </section>
      )}

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        <button className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>
          all
        </button>
        {types.map((t) => (
          <button key={t} className={typeFilter === t ? 'active' : ''} onClick={() => setTypeFilter(t)}>
            {t}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="tags" style={{ margin: '10px 0' }}>
          {tags.slice(0, 20).map((t) => (
            <button
              key={t}
              className={`tag linkish ${tagFilter === t ? 'active' : ''}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <section className="memory-list">
        {byDay.map(([day, items]) => (
          <div key={day}>
            <h2>{day}</h2>
            {items.map((m) => (
              <MemoryCard key={m.id} memory={m} onDelete={handleDelete} />
            ))}
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">Nothing matches.</p>}
      </section>
    </>
  )
}
