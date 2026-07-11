import { useEffect, useState, useCallback } from 'react'
import type { Memory, RetrievedMemory } from './types'
import { saveMemory, deleteMemory, listMemories, requestPersistentStorage } from './services/memories'
import { preloadEmbedder } from './services/embedder'
import { search } from './services/retriever'
import {
  isWebGPUSupported,
  hasOptedIn,
  setOptedIn,
  loadEngine,
  isEngineReady,
  generateAnswer,
  type LoadProgress,
} from './services/generator'
import './App.css'

type Tab = 'remember' | 'ask'

function App() {
  const [tab, setTab] = useState<Tab>('remember')
  const [memories, setMemories] = useState<Memory[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const [question, setQuestion] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<RetrievedMemory[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [llmState, setLlmState] = useState<'unsupported' | 'off' | 'loading' | 'ready'>(
    () => (!isWebGPUSupported() ? 'unsupported' : hasOptedIn() ? 'loading' : 'off'),
  )
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null)

  const startEngine = useCallback(() => {
    setLlmState('loading')
    loadEngine(setLoadProgress)
      .then(() => setLlmState('ready'))
      .catch(() => setLlmState('off'))
  }, [])

  const refresh = useCallback(async () => {
    setMemories(await listMemories())
  }, [])

  useEffect(() => {
    requestPersistentStorage()
    preloadEmbedder()
    refresh()
    if (isWebGPUSupported() && hasOptedIn()) startEngine()
  }, [refresh, startEngine])

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
    <div className="app">
      <header>
        <h1>Memory DB</h1>
        <nav className="tabs">
          <button className={tab === 'remember' ? 'active' : ''} onClick={() => setTab('remember')}>
            Remember
          </button>
          <button className={tab === 'ask' ? 'active' : ''} onClick={() => setTab('ask')}>
            Ask
          </button>
        </nav>
      </header>

      {tab === 'remember' && (
        <>
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
        </>
      )}

      {tab === 'ask' && (
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
              placeholder="e.g. What's my locker code?"
              rows={2}
            />
            <button onClick={handleAsk} disabled={searching || !question.trim()}>
              {searching ? 'Searching…' : 'Ask'}
            </button>
          </section>

          {llmState === 'off' && (
            <div className="llm-banner">
              <p>
                Enable smart answers — downloads a ~1GB AI model once, then answers run
                fully on this device. Wi-Fi recommended.
              </p>
              <button
                onClick={() => {
                  setOptedIn(true)
                  startEngine()
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
              Smart answers need WebGPU (Safari 26+ / Chrome). Showing best-matching
              memories instead.
            </p>
          )}

          {answer !== null && (
            <div className="answer-card">
              <p>{answer}</p>
            </div>
          )}

          <section className="memory-list">
            {searching && <p className="empty">Searching your memories…</p>}
            {results !== null && results.length === 0 && (
              <p className="empty">No matching memories found.</p>
            )}
            {results !== null && results.length > 0 && <h2>Source memories</h2>}
            {results?.map(({ memory, score }) => (
              <div key={memory.id} className="memory-card">
                <p>{memory.text}</p>
                <div className="memory-meta">
                  <span>{new Date(memory.createdAt).toLocaleString()}</span>
                  <span className="score">{Math.round(score * 100)}% match</span>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

export default App
