import { useEffect, useRef, useState, useCallback } from 'react'
import type { Memory } from './types'
import { listMemories, requestPersistentStorage } from './services/memories'
import { preloadEmbedder } from './services/embedder'
import { isWebGPUSupported, loadEngine, type LoadProgress } from './services/generator'
import { syncConfigured, getSession, getSupabase, flushOutbox, startAutoSync } from './services/sync'
import { notifyImminentEvents } from './services/digest'
import { isLockEnabled } from './services/auth'
import { HomeTab } from './components/HomeTab'
import { AskTab } from './components/AskTab'
import { BrowseTab } from './components/BrowseTab'
import { BackupTab } from './components/BackupTab'
import { LockScreen } from './components/LockScreen'
import './App.css'

const RELOCK_AFTER_MS = 2 * 60 * 1000

type Tab = 'home' | 'ask' | 'browse' | 'backup'

function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [memories, setMemories] = useState<Memory[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [storageUsage, setStorageUsage] = useState<string | null>(null)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  // Loading itself is deferred to AskTab's mount — this only decides whether
  // Ask should auto-start it (silently, from cache) the first time it's opened.
  const [llmState, setLlmState] = useState<'unsupported' | 'off' | 'loading' | 'ready'>(() =>
    !isWebGPUSupported() ? 'unsupported' : 'off',
  )
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null)
  const [locked, setLocked] = useState(() => isLockEnabled())
  const hiddenAt = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    setMemories(await listMemories())
  }, [])

  const startEngine = useCallback(() => {
    setLlmState('loading')
    loadEngine(setLoadProgress)
      .then(() => setLlmState('ready'))
      .catch(() => setLlmState('off'))
  }, [])

  useEffect(() => {
    requestPersistentStorage()
    preloadEmbedder()
    refresh()
    void notifyImminentEvents()
    // LLM load is deferred to AskTab's own mount — starting it eagerly here
    // added memory pressure on every screen, not just Ask, and contributed
    // to tab crashes on constrained devices (Safari on phone especially).
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else if (isLockEnabled() && hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    navigator.storage?.estimate?.().then((est) => {
      if (est.usage != null) setStorageUsage(`${(est.usage / 1024 / 1024).toFixed(0)} MB used locally`)
    })
    let unsubscribeAuth: (() => void) | undefined
    if (syncConfigured) {
      startAutoSync()
      getSession().then((s) => setSignedInAs(s?.user.email ?? null))
      const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
        setSignedInAs(session?.user.email ?? null)
        if (session) void flushOutbox()
      })
      unsubscribeAuth = () => sub.subscription.unsubscribe()
    }
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      unsubscribeAuth?.()
    }
  }, [refresh])

  if (locked) {
    return (
      <div className="app">
        <LockScreen onUnlocked={() => setLocked(false)} />
      </div>
    )
  }

  return (
    <div className="app">
      {!online && (
        <div className="offline-banner">
          Offline — everything still works; backup resumes when you reconnect.
        </div>
      )}
      {tab !== 'home' && (
        <header>
          <h1>Memory DB</h1>
        </header>
      )}
      <nav className="tabs">
        {(['home', 'ask', 'browse', 'backup'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'home' && <HomeTab memories={memories} onChanged={refresh} />}
      {tab === 'ask' && (
        <AskTab llmState={llmState} loadProgress={loadProgress} onEnableLlm={startEngine} />
      )}
      {tab === 'browse' && <BrowseTab memories={memories} onChanged={refresh} />}
      {tab === 'backup' && (
        <BackupTab signedInAs={signedInAs} storageUsage={storageUsage} onChanged={refresh} />
      )}
    </div>
  )
}

export default App
