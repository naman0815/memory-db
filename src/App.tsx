import { useEffect, useState, useCallback } from 'react'
import type { Memory } from './types'
import { saveMemory, deleteMemory, listMemories, requestPersistentStorage } from './services/memories'
import './App.css'

function App() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setMemories(await listMemories())
  }, [])

  useEffect(() => {
    requestPersistentStorage()
    refresh()
  }, [refresh])

  async function handleSave() {
    const text = input.trim()
    if (!text) return
    setSaving(true)
    try {
      await saveMemory(text)
      setInput('')
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteMemory(id)
    await refresh()
  }

  return (
    <div className="app">
      <header>
        <h1>Memory DB</h1>
        <p className="tagline">Tell me something to remember</p>
      </header>

      <section className="capture">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSave()
            }
          }}
          placeholder="e.g. My locker code is 4421"
          rows={3}
        />
        <button onClick={handleSave} disabled={saving || !input.trim()}>
          {saving ? 'Saving…' : 'Remember'}
        </button>
      </section>

      <section className="memory-list">
        <h2>{memories.length} memories</h2>
        {memories.map((m) => (
          <div key={m.id} className="memory-card">
            <p>{m.text}</p>
            <div className="memory-meta">
              <span>{new Date(m.createdAt).toLocaleString()}</span>
              <button className="delete" onClick={() => handleDelete(m.id)} aria-label="Delete memory">
                ×
              </button>
            </div>
          </div>
        ))}
        {memories.length === 0 && <p className="empty">Nothing stored yet.</p>}
      </section>
    </div>
  )
}

export default App
