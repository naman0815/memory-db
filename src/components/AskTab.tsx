import { useState } from 'react'
import type { RetrievedMemory } from '../types'
import { search } from '../services/retriever'
import { isEngineReady, generateAnswer, isWebGPUSupported, hasOptedIn, setOptedIn, type LoadProgress } from '../services/generator'
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

  async function handleAsk() {
    const q = question.trim()
    if (!q) return
    setSearching(true)
    setResults(null)
    setAnswer(null)
    try {
      const retrieved = await search(q)
      setResults(retrieved)
      if (isEngineReady() && retrieved.length > 0) {
        await generateAnswer(q, retrieved, setAnswer)
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
            Enable smart answers — downloads a ~1GB AI model once, then answers run fully on this
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

      {answer !== null && (
        <div className="answer-card">
          <p>{answer}</p>
        </div>
      )}

      <section className="memory-list">
        {searching && <p className="empty">Searching your memories…</p>}
        {results !== null && results.length === 0 && <p className="empty">No matching memories found.</p>}
        {results !== null && results.length > 0 && <h2>Source memories</h2>}
        {results?.map(({ memory, score }) => (
          <MemoryCard key={memory.id} memory={memory} score={score} />
        ))}
      </section>
    </>
  )
}
