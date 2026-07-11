import { useMemo, useRef, useState } from 'react'
import type { Memory, MemoryType } from '../types'
import { saveMemory, attachExtractedText, deleteMemory } from '../services/memories'
import { flushOutbox } from '../services/sync'
import { ocrImage } from '../services/ocr'
import { extractPdfText } from '../services/pdf'
import { transcribeAudio } from '../services/audio'
import { captionOptedIn, captionImage } from '../services/caption'
import { isSpeechSupported, startDictation, type DictationHandle } from '../services/speech'
import { iconForCategory } from '../services/categoryIcon'
import { Icon } from './icons'

function fmtDate(ts: number): string {
  const diffH = Math.round((Date.now() - ts) / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}

function labelOf(m: Memory): string {
  return m.text || m.caption || m.extractedText?.slice(0, 60) || m.type
}

export function HomeTab({ memories, onChanged }: { memories: Memory[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [dictating, setDictating] = useState(false)
  const [dictation, setDictation] = useState<DictationHandle | null>(null)
  const [processing, setProcessing] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

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

  const pinned = useMemo(
    () => [...categories].sort((a, b) => b.count - a.count).slice(0, 2),
    [categories],
  )

  const recentThings = useMemo(
    () => [...memories].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
    [memories],
  )

  const entries = useMemo(() => {
    const list = filter ? byCategory.get(filter) ?? [] : memories
    return [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30)
  }, [filter, byCategory, memories])

  function track(label: string, work: Promise<void>) {
    setProcessing((p) => [...p, label])
    work.finally(() => setProcessing((p) => p.filter((l) => l !== label)))
  }

  async function handleSave() {
    const text = input.trim()
    if (!text) return
    setInput('')
    await saveMemory({ text, category: filter ?? undefined }, onChanged)
    onChanged()
    void flushOutbox()
  }

  async function handleFile(file: File) {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const isAudio = file.type.startsWith('audio/')
    const type: MemoryType = isImage ? 'image' : isPdf ? 'pdf' : isAudio ? 'audio' : 'note'
    const memory = await saveMemory({ text: input.trim(), type, blob: file, category: filter ?? undefined })
    setInput('')
    onChanged()
    void flushOutbox()

    if (isImage) {
      track(`Reading ${file.name}…`, (async () => {
        const [text, caption] = await Promise.all([
          ocrImage(file).catch(() => ''),
          captionOptedIn() ? captionImage(file).catch(() => undefined) : Promise.resolve(undefined),
        ])
        if (text || caption) await attachExtractedText(memory.id, text, caption, onChanged)
        onChanged()
      })())
    } else if (isPdf) {
      track(`Extracting ${file.name}…`, (async () => {
        const text = await extractPdfText(file).catch(() => '')
        if (text) await attachExtractedText(memory.id, text, undefined, onChanged)
        onChanged()
      })())
    } else if (isAudio) {
      track('Transcribing audio…', (async () => {
        const text = await transcribeAudio(file).catch(() => '')
        if (text) await attachExtractedText(memory.id, text, undefined, onChanged)
        onChanged()
      })())
    }
  }

  function toggleDictation() {
    if (dictating) {
      dictation?.stop()
      return
    }
    setDictating(true)
    const handle = startDictation({
      onTranscript: (text) => setInput(text),
      onEnd: () => {
        setDictating(false)
        setDictation(null)
      },
      onError: () => {
        setDictating(false)
        setDictation(null)
      },
    })
    setDictation(handle)
  }

  async function handleDelete(id: string) {
    await deleteMemory(id)
    onChanged()
    void flushOutbox()
  }

  return (
    <div className="home">
      <div className="home-greet">
        <span className="home-asterisk">✳</span>
        <h1 className="home-title">Hello</h1>
      </div>

      {pinned.length > 0 && (
        <>
          <div className="home-section-head">
            <h2>Pinned stuff</h2>
          </div>
          <div className="home-grid2">
            {pinned.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`home-tile ${filter === c.name ? 'active' : ''}`}
                onClick={() => setFilter(filter === c.name ? null : c.name)}
              >
                <div className="home-tile-icon">
                  <Icon name={iconForCategory(c.name)} />
                </div>
                <div className="home-tile-text">
                  <div className="home-tile-title">{c.name}</div>
                  <div className="home-tile-sub">
                    {c.count} {c.count === 1 ? 'entry' : 'entries'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {recentThings.length > 0 && (
        <>
          <div className="home-section-head">
            <h2>Recent things</h2>
          </div>
          <div className="home-hscroll">
            {recentThings.map((m) => (
              <div key={m.id} className="home-hcard">
                <div className="home-tile-icon">
                  <Icon name={iconForCategory(m.category || 'General')} />
                </div>
                <div className="home-tile-text">
                  <div className="home-tile-title">{labelOf(m)}</div>
                  <div className="home-tile-sub">{m.category || 'General'}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {categories.length > 0 && (
        <>
          <div className="home-section-head">
            <h2>My stuff ({categories.length})</h2>
          </div>
          <div className="home-grid2">
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`home-tile ${filter === c.name ? 'active' : ''}`}
                onClick={() => setFilter(filter === c.name ? null : c.name)}
              >
                <div className={`home-tile-icon-outline ${filter === c.name ? 'active' : ''}`}>
                  <Icon name={iconForCategory(c.name)} />
                </div>
                <div className="home-tile-text">
                  <div className="home-tile-title">{c.name}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="home-section-head">
        <h2>{filter ? `${filter} (${entries.length})` : `Recent entries (${entries.length})`}</h2>
        {filter && (
          <button type="button" className="home-view-all" onClick={() => setFilter(null)}>
            Clear
          </button>
        )}
      </div>
      <div className="home-entry-list">
        {entries.map((m) => (
          <div key={m.id} className="home-entry-card">
            <p className="home-entry-text">{labelOf(m)}</p>
            <div className="home-entry-rule" />
            <div className="home-entry-meta">
              <span>{fmtDate(m.createdAt)}</span>
              <button type="button" aria-label="Delete" className="home-delete" onClick={() => handleDelete(m.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="home-empty">Nothing here yet.</p>}
      </div>

      {processing.map((label) => (
        <p key={label} className="home-processing">
          ⏳ {label}
        </p>
      ))}

      <div className="home-bottom-spacer" />

      <div className="home-composer-wrap">
        <div className="home-composer">
          <input
            className="home-composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
            }}
            placeholder="What's on your mind?"
          />
          <div className="home-composer-row">
            <button
              type="button"
              aria-label="Add"
              className="home-round-btn"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="plus" />
            </button>
            <div className="home-composer-right">
              {isSpeechSupported() && (
                <button
                  type="button"
                  aria-label="Dictate"
                  className={`home-round-btn ${dictating ? 'recording' : ''}`}
                  onClick={toggleDictation}
                >
                  <Icon name="mic" />
                </button>
              )}
              <button type="button" aria-label="Send" className="home-send-btn" onClick={handleSave}>
                <Icon name="send" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,audio/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
