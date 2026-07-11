const PINS_KEY = 'pinned-categories'

export function getPinnedCategories(): string[] {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function togglePinnedCategory(category: string, current: string[]): string[] {
  const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
  localStorage.setItem(PINS_KEY, JSON.stringify(next))
  return next
}
