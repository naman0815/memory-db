import { useMemo, useState } from 'react'
import type { Memory, MemoryType } from '../types'
import { deleteMemory } from '../services/memories'
import { flushOutbox } from '../services/sync'
import { iconForCategory } from '../services/categoryIcon'
import { Icon } from './icons'
import { MemoryCard } from './MemoryCard'

const ICON_PIN = `${import.meta.env.BASE_URL}icon-pin.png`

export function BrainTab({
  memories,
  onChanged,
  pinnedCategories,
  onTogglePin,
}: {
  memories: Memory[]
  onChanged: () => void
  pinnedCategories: string[]
  onTogglePin: (category: string) => void
}) {
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const byCategory = useMemo(() => {
    const groups = new Map<string, Memory[]>()
    for (const m of memories) {
      const cat = m.category || 'General'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(m)
    }
    return groups
  }, [memories])

  const categories = useMemo(
    () => [...byCategory.entries()].map(([name, items]) => ({ name, count: items.length })),
    [byCategory],
  )

  const types = useMemo(() => [...new Set(memories.map((m) => m.type))], [memories])
  const tags = useMemo(() => [...new Set(memories.flatMap((m) => m.tags ?? []))].sort(), [memories])

  const filtered = memories.filter(
    (m) =>
      (typeFilter === 'all' || m.type === typeFilter) &&
      (!tagFilter || m.tags?.includes(tagFilter)) &&
      (!categoryFilter || (m.category || 'General') === categoryFilter),
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
      {categories.length > 0 && (
        <>
          <div className="home-section-head">
            <h2>My stuff ({categories.length})</h2>
          </div>
          <div className="home-grid2">
            {categories.map((c) => {
              const isPinned = pinnedCategories.includes(c.name)
              const isActive = categoryFilter === c.name
              return (
                <div key={c.name} className={`home-tile brain-tile ${isActive ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="brain-tile-main"
                    onClick={() => setCategoryFilter(isActive ? null : c.name)}
                  >
                    <div className={`home-tile-icon-outline ${isActive ? 'active' : ''}`}>
                      <Icon name={iconForCategory(c.name)} />
                    </div>
                    <div className="home-tile-text">
                      <div className="home-tile-title">{c.name}</div>
                      <div className="home-tile-sub">
                        {c.count} {c.count === 1 ? 'entry' : 'entries'}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={isPinned ? 'Unpin' : 'Pin'}
                    className={`brain-pin-btn ${isPinned ? 'pinned' : ''}`}
                    onClick={() => onTogglePin(c.name)}
                  >
                    <img src={ICON_PIN} alt="" className="pin-icon-img" />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="tabs" style={{ flexWrap: 'wrap', marginTop: 20 }}>
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
