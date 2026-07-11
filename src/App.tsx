import { useEffect, useState, useCallback } from 'react'
import type { Memory } from './types'
import { listMemories, requestPersistentStorage } from './services/memories'
import { preloadEmbedder } from './services/embedder'
import { isWebGPUSupported, hasOptedIn, loadEngine, type LoadProgress } from './services/generator'
import { syncConfigured, getSession, getSupabase, flushOutbox, startAutoSync } from './services/sync'
import { notifyImminentEvents } from './services/digest'
import { RememberTab } from './components/RememberTab'
import { AskTab } from './components/AskTab'
import { BrowseTab } from './components/BrowseTab'
import { BackupTab } from './components/BackupTab'
import './App.css'

type Tab = 'remember' | 'ask' | 'browse' | 'backup'

function App() {
  const [tab, setTab] = useState<Tab>('remember')
  const [memories, setMemories] = useState<Memory[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [storageUsage, setStorageUsage] = useState<string | null>(null)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [llmState, setLlmState] = useState<'unsupported' | 'off' | 'loading' | 'ready'>(() =>
    !isWebGPUSupported() ? 'unsupported' : hasOptedIn() ? 'loading' : 'off',
  )
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null)

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
    if (isWebGPUSupported() && hasOptedIn()) startEngine()
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
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
      unsubscribeAuth?.()
    }
  }, [refresh, startEngine])

  return (
    <div className="app">
      {!online && (
        <div className="offline-banner">
          Offline — everything still works; backup resumes when you reconnect.
        </div>
      )}
      <header>
        <h1>Memory DB</h1>
        <nav className="tabs">
          {(['remember', 'ask', 'browse', 'backup'] as const).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'remember' && <RememberTab memories={memories} onChanged={refresh} />}
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
