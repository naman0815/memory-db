import { useMemo, useState } from 'react'
import type { Memory } from '../types'
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
  onOpenMemory,
}: {
  memories: Memory[]
  onChanged: () => void
  pinnedCategories: string[]
  onTogglePin: (category: string) => void
  onOpenMemory: (memory: Memory) => void
}) {
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

  const filtered = memories.filter(
    (m) =>
      (!tagFilter || m.tags?.includes(tagFilter)) && (!categoryFilter || (m.category || 'General') === categoryFilter),
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
    <div className="tab-page">
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
                    aria-pressed={isActive}
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

      {(tagFilter || categoryFilter) && (
        <div className="home-section-head">
          <h2>
            {categoryFilter && `Category: ${categoryFilter}`}
            {categoryFilter && tagFilter && ' · '}
            {tagFilter && `#${tagFilter}`}
          </h2>
          <button
            type="button"
            className="home-view-all"
            onClick={() => {
              setTagFilter(null)
              setCategoryFilter(null)
            }}
          >
            Clear
          </button>
        </div>
      )}

      <section className="memory-list" style={{ marginTop: tagFilter || categoryFilter ? 0 : 20 }}>
        {byDay.map(([day, items]) => (
          <div key={day}>
            <h2>{day}</h2>
            {items.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onDelete={handleDelete}
                onOpen={onOpenMemory}
                onTagClick={(t) => setTagFilter(tagFilter === t ? null : t)}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="empty">
            {memories.length === 0
              ? "You haven't saved anything yet — add a note, photo, or voice memo from Home."
              : 'Nothing matches this filter.'}
          </p>
        )}
      </section>
    </div>
  )
}
