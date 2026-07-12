import { useEffect, useMemo, useRef, useState } from 'react'
import type { Memory, MemoryType, RetrievedMemory } from '../types'
import { saveMemory, attachExtractedText, getMemoryById } from '../services/memories'
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

function labelOf(m: Memory): string {
  return m.text || m.caption || m.extractedText?.slice(0, 60) || m.type
}

function fmtUpcoming(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
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

  return (
    <div className="home tab-page">
      <div className="home-greet">
        <h1 className="home-title">Hello{userName ? `, ${userName}` : ''}</h1>
      </div>

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
        <>
          <div className="home-section-head">
            <h2>Upcoming</h2>
          </div>
          <div className="home-hscroll">
            {upcoming.slice(0, 5).map((m) => (
              <div key={m.id} className="home-hcard">
                <div className="home-tile-icon">
                  <Icon name={iconForCategory(m.category || 'General')} />
                </div>
                <div className="home-tile-text">
                  <div className="home-tile-title">{labelOf(m)}</div>
                  <div className="home-tile-sub">{fmtUpcoming(m.eventDate!)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

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

      {answer !== null && (
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
