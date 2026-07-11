import { useEffect, useState } from 'react'
import type { RetrievedMemory } from '../types'
import { search } from '../services/retriever'
import {
  isEngineReady,
  generateAnswer,
  isDirectHit,
  isWebGPUSupported,
  hasOptedIn,
  setOptedIn,
  NOT_REMEMBERED,
  type LoadProgress,
} from '../services/generator'
import { MemoryCard } from './MemoryCard'

export function AskTab({
  llmState,
  loadProgress,
  onEnableLlm,
}: {
  llmState: 'unsupported' | 'off' | 'loading' | 'ready'
  loadProgress: LoadProgress | null
  onEnableLlm: () => void
}) {
  const [question, setQuestion] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<RetrievedMemory[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  // Silent (re)load on tab open — only if the user already opted in on a
  // previous visit. First-ever opt-in still requires the explicit button below.
  useEffect(() => {
    if (llmState === 'off' && isWebGPUSupported() && hasOptedIn()) onEnableLlm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAsk() {
    const q = question.trim()
    if (!q) return
    setSearching(true)
    setResults(null)
    setAnswer(null)
    setGenError(null)
    try {
      const retrieved = await search(q)
      setResults(retrieved)
      if (retrieved.length === 0) {
        // Explicit, consistent refusal regardless of whether the LLM is even
        // running — the memory DB is the only source of truth, so nothing
        // found means saying so, not guessing.
        setAnswer(NOT_REMEMBERED)
      } else if (isDirectHit(retrieved)) {
        // A small local model is unreliable at "quoting" numbers/codes without
        // swapping digits — when one memory clearly dominates, show it
        // directly instead of risking a paraphrase.
        const top = retrieved[0].memory
        setAnswer(top.text || top.caption || top.extractedText || null)
      } else if (isEngineReady() && retrieved.length > 0) {
        try {
          await generateAnswer(q, retrieved, setAnswer)
        } catch {
          // Model crashed, or the fabrication guard rejected the answer —
          // the matched memories above are already shown, so fail soft here
          // and silently reload the engine in the background for next time.
          setAnswer(null)
          setGenError('Smart answer unavailable — showing matched memories instead.')
          onEnableLlm()
        }
      }
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      <section className="capture">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleAsk()
            }
          }}
          placeholder="e.g. What's my locker code? · tickets for this weekend · what did I save last week?"
          rows={2}
        />
        <button onClick={handleAsk} disabled={searching || !question.trim()}>
          {searching ? 'Searching…' : 'Ask'}
        </button>
      </section>

      {llmState === 'off' && isWebGPUSupported() && !hasOptedIn() && (
        <div className="llm-banner">
          <p>
            Enable smart answers — downloads a small AI model once, then answers run fully on this
            device. Wi-Fi recommended.
          </p>
          <button
            onClick={() => {
              setOptedIn(true)
              onEnableLlm()
            }}
          >
            Enable smart answers
          </button>
        </div>
      )}
      {llmState === 'loading' && (
        <div className="llm-banner">
          <p>{loadProgress?.text ?? 'Preparing AI model…'}</p>
          <progress value={loadProgress?.progress ?? 0} max={1} />
        </div>
      )}
      {llmState === 'unsupported' && (
        <p className="llm-note">
          Smart answers need WebGPU (Safari 26+ / Chrome). Showing best-matching memories instead.
        </p>
      )}
      {genError && <p className="llm-note">{genError}</p>}

      {answer !== null && (
        <div className="answer-card">
          <p>{answer}</p>
        </div>
      )}

      <section className="memory-list">
        {searching && <p className="empty">Searching your memories…</p>}
        {results !== null && results.length > 0 && <h2>Source memories</h2>}
        {results?.map(({ memory, score }) => (
          <MemoryCard key={memory.id} memory={memory} score={score} />
        ))}
      </section>
    </>
  )
}
