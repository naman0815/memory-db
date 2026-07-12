import { useEffect, useMemo, useRef, useState } from 'react'
import type { Memory, MemoryType, RetrievedMemory } from '../types'
import {
  saveMemory,
  attachExtractedText,
  deleteMemory,
  updateMemoryText,
  getMemoryById,
} from '../services/memories'
import { flushOutbox } from '../services/sync'
import { ocrImage } from '../services/ocr'
import { extractPdfText } from '../services/pdf'
import { transcribeAudio } from '../services/audio'
import { isSpeechSupported, startDictation, type DictationHandle } from '../services/speech'
import { iconForCategory } from '../services/categoryIcon'
import { looksLikeQuestion } from '../services/intent'
import { search, relatedMemories } from '../services/retriever'
import {
  isEngineReady,
  generateAnswer,
  isDirectHit,
  buildDirectAnswer,
  NOT_REMEMBERED,
} from '../services/generator'
import { upcomingMemories, buildDigest, digestDue, markDigestShown, type Digest } from '../services/digest'
import { Icon } from './icons'
import { MemoryCard } from './MemoryCard'

function fmtDate(ts: number): string {
  const diffH = Math.round((Date.now() - ts) / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}

function labelOf(m: Memory): string {
  return m.text || m.caption || m.extractedText?.slice(0, 60) || m.type
}

export function HomeTab({
  memories,
  onChanged,
  pinnedCategories,
  userName,
  onEnableLlm,
}: {
  memories: Memory[]
  onChanged: () => void
  pinnedCategories: string[]
  userName: string
  onEnableLlm: () => void
}) {
  const [filter, setFilter] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [dictating, setDictating] = useState(false)
  const [dictation, setDictation] = useState<DictationHandle | null>(null)
  const [processing, setProcessing] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const [asking, setAsking] = useState(false)
  const [results, setResults] = useState<RetrievedMemory[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const [digest, setDigest] = useState<Digest | null>(null)
  const [upcoming, setUpcoming] = useState<Memory[]>([])
  const [linkSuggestion, setLinkSuggestion] = useState<{ label: string; related: Memory } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  useEffect(() => {
    upcomingMemories().then(setUpcoming)
    if (digestDue()) {
      buildDigest().then((d) => {
        setDigest(d)
        markDigestShown()
      })
    }
  }, [memories])

  const byCategory = useMemo(() => {
    const groups = new Map<string, Memory[]>()
    for (const m of memories) {
      const cat = m.category || 'General'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(m)
    }
    return groups
  }, [memories])

  const pinned = useMemo(
    () =>
      pinnedCategories
        .filter((name) => byCategory.has(name))
        .map((name) => ({ name, count: byCategory.get(name)!.length })),
    [pinnedCategories, byCategory],
  )

  const recentThings = useMemo(
    () => [...memories].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
    [memories],
  )

  const entries = useMemo(() => {
    // filter matches either a category tile (pinned/brain-tab style) or a
    // tag chip clicked on an entry — same state, two ways in.
    const list = filter
      ? memories.filter((m) => (m.category || 'General') === filter || m.tags?.includes(filter))
      : memories
    return [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30)
  }, [filter, memories])

  const mode = looksLikeQuestion(input) ? 'ask' : 'save'

  function track(label: string, work: Promise<void>) {
    setProcessing((p) => [...p, label])
    work.finally(() => setProcessing((p) => p.filter((l) => l !== label)))
  }

  function clearAnswer() {
    setAnswer(null)
    setResults(null)
    setGenError(null)
  }

  /**
   * After a memory finishes embedding, check whether it's a strong semantic
   * match for something already saved and surface a one-tap suggestion —
   * the embedding/relatedMemories() machinery already existed for the
   * "related" button, this just proactively runs it once on save instead of
   * waiting for the user to think to check.
   */
  async function checkForLinks(id: string) {
    const fresh = await getMemoryById(id)
    if (!fresh) return
    const related = await relatedMemories(fresh, 1)
    if (related.length && related[0].score >= 0.5) {
      setLinkSuggestion({ label: labelOf(fresh), related: related[0].memory })
    }
  }

  async function handleAsk(question: string) {
    setAsking(true)
    clearAnswer()
    try {
      const retrieved = await search(question)
      setResults(retrieved)
      if (retrieved.length === 0) {
        setAnswer(NOT_REMEMBERED)
      } else if (isDirectHit(retrieved)) {
        setAnswer(buildDirectAnswer(retrieved[0].memory, question))
      } else if (isEngineReady()) {
        try {
          await generateAnswer(question, retrieved, setAnswer)
        } catch {
          setAnswer(null)
          setGenError('Smart answer unavailable — showing matched memories instead.')
          onEnableLlm()
        }
      }
    } finally {
      setAsking(false)
    }
  }

  async function handleSubmit() {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (looksLikeQuestion(text)) {
      await handleAsk(text)
    } else {
      clearAnswer()
      const memory = await saveMemory({ text, category: filter ?? undefined }, () => {
        onChanged()
        checkForLinks(memory.id)
      })
      onChanged()
      void flushOutbox()
    }
  }

  async function handleFile(file: File) {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const isAudio = file.type.startsWith('audio/')
    const type: MemoryType = isImage ? 'image' : isPdf ? 'pdf' : isAudio ? 'audio' : 'note'
    clearAnswer()
    const memory = await saveMemory({ text: input.trim(), type, blob: file, category: filter ?? undefined })
    setInput('')
    onChanged()
    void flushOutbox()

    if (isImage) {
      track(`Reading ${file.name}…`, (async () => {
        const text = await ocrImage(file).catch(() => '')
        if (text) await attachExtractedText(memory.id, text, onChanged)
        onChanged()
        checkForLinks(memory.id)
      })())
    } else if (isPdf) {
      track(`Extracting ${file.name}…`, (async () => {
        const text = await extractPdfText(file).catch(() => '')
        if (text) await attachExtractedText(memory.id, text, onChanged)
        onChanged()
        checkForLinks(memory.id)
      })())
    } else if (isAudio) {
      track('Transcribing audio…', (async () => {
        const text = await transcribeAudio(file).catch(() => '')
        if (text) await attachExtractedText(memory.id, text, onChanged)
        onChanged()
        checkForLinks(memory.id)
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

  async function handleSaveEdit(id: string) {
    setEditingId(null)
    await updateMemoryText(id, editDraft, onChanged)
    void flushOutbox()
  }

  return (
    <div className="home tab-page">
      {digest && (
        <div className="digest-banner">
          <p>
            {digest.recentCount} new {digest.recentCount === 1 ? 'memory' : 'memories'} this week ·{' '}
            {digest.totalCount} total
            {digest.expiringSoon.length > 0 && (
              <>
                {' '}
                · {digest.expiringSoon.length} expiring in 3 days
              </>
            )}
            {digest.topTags.length > 0 && <> · mostly {digest.topTags.slice(0, 3).join(', ')}</>}
          </p>
          <button onClick={() => setDigest(null)}>Dismiss</button>
        </div>
      )}

      {linkSuggestion && (
        <div className="digest-banner">
          <p>
            "{linkSuggestion.label}" looks related to "{labelOf(linkSuggestion.related)}".
          </p>
          <button onClick={() => setLinkSuggestion(null)}>Dismiss</button>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="memory-list" style={{ marginBottom: 20 }}>
          <h2>Upcoming</h2>
          {upcoming.slice(0, 5).map((m) => (
            <div key={m.id} className="upcoming-item">
              <strong>{new Date(m.eventDate!).toLocaleString()}</strong>
              <span>{m.text || m.extractedText?.slice(0, 40) || m.type}</span>
            </div>
          ))}
        </section>
      )}

      <div className="home-greet">
        <h1 className="home-title">Hello{userName ? `, ${userName}` : ''}</h1>
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

      {answer !== null ? (
        <>
          <div className="home-section-head">
            <h2>Answer</h2>
            <button type="button" className="home-view-all" onClick={clearAnswer}>
              Back
            </button>
          </div>
          <div className="answer-card">
            <p>{answer}</p>
          </div>
          {genError && <p className="llm-note">{genError}</p>}
          <section className="memory-list">
            {results !== null && results.length > 0 && <h2>Source memories</h2>}
            {results?.map(({ memory, score }) => (
              <MemoryCard key={memory.id} memory={memory} score={score} />
            ))}
          </section>
        </>
      ) : (
        <>
          <div className="home-section-head">
            <h2>{filter ? `${filter} (${entries.length})` : `Recent entries (${entries.length})`}</h2>
            {filter && (
              <button type="button" className="home-view-all" onClick={() => setFilter(null)}>
                Clear
              </button>
            )}
          </div>
          <div className="home-entry-list">
            {entries.map((m) =>
              editingId === m.id ? (
                <div key={m.id} className="home-entry-card">
                  <textarea
                    className="edit-textarea"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="home-entry-rule" />
                  <div className="home-entry-meta">
                    <button type="button" className="linkish" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button type="button" className="linkish" onClick={() => handleSaveEdit(m.id)}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="home-entry-card">
                  <p className="home-entry-text">{labelOf(m)}</p>
                  {m.tags && m.tags.length > 0 && (
                    <div className="tags">
                      {m.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`tag linkish ${filter === t ? 'active' : ''}`}
                          onClick={() => setFilter(filter === t ? null : t)}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="home-entry-rule" />
                  <div className="home-entry-meta">
                    <span>{fmtDate(m.createdAt)}</span>
                    <span>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => {
                          setEditingId(m.id)
                          setEditDraft(m.text)
                        }}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        className="home-delete"
                        onClick={() => handleDelete(m.id)}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                </div>
              ),
            )}
            {entries.length === 0 && <p className="home-empty">Nothing here yet.</p>}
          </div>
        </>
      )}

      {asking && <p className="home-processing">Searching your memories…</p>}
      {processing.map((label) => (
        <p key={label} className="home-processing">
          {label}
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
                handleSubmit()
              }
            }}
            placeholder="What's on your mind? (or ask a question)"
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
              <button
                type="button"
                className={`home-mode-btn ${mode}`}
                onClick={handleSubmit}
                disabled={!input.trim()}
              >
                {mode === 'ask' ? 'Ask' : 'Save'}
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
