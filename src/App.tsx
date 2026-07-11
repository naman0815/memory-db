import { useEffect, useRef, useState, useCallback } from 'react'
import type { Memory } from './types'
import { listMemories, requestPersistentStorage } from './services/memories'
import { preloadEmbedder } from './services/embedder'
import { isWebGPUSupported, loadEngine, hasOptedIn, type LoadProgress } from './services/generator'
import { syncConfigured, getSession, getSupabase, flushOutbox, startAutoSync } from './services/sync'
import { notifyImminentEvents } from './services/digest'
import { isLockEnabled } from './services/auth'
import { getPinnedCategories, togglePinnedCategory } from './services/pins'
import { getUserName, setUserName } from './services/profile'
import { HomeTab } from './components/HomeTab'
import { BrainTab } from './components/BrainTab'
import { SettingsTab } from './components/SettingsTab'
import { LockScreen } from './components/LockScreen'
import './App.css'

const RELOCK_AFTER_MS = 2 * 60 * 1000

type Tab = 'home' | 'brain' | 'settings'

function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [memories, setMemories] = useState<Memory[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [storageUsage, setStorageUsage] = useState<string | null>(null)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [pinnedCategories, setPinnedCategories] = useState<string[]>(() => getPinnedCategories())
  const [userName, setUserNameState] = useState(() => getUserName())
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

  function handleTogglePin(category: string) {
    setPinnedCategories((current) => togglePinnedCategory(category, current))
  }

  function handleNameChange(name: string) {
    setUserName(name)
    setUserNameState(name.trim())
  }

  useEffect(() => {
    requestPersistentStorage()
    preloadEmbedder()
    refresh()
    void notifyImminentEvents()
    // Silent — no loading UI is shown outside Settings. Only kicks in if the
    // user already opted in on a previous visit.
    if (isWebGPUSupported() && hasOptedIn()) startEngine()
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
  }, [refresh, startEngine])

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

      <nav className="main-nav">
        <div className="main-nav-left">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
            Home
          </button>
          <button className={tab === 'brain' ? 'active' : ''} onClick={() => setTab('brain')}>
            Brain
          </button>
        </div>
        <button
          className={`main-nav-settings ${tab === 'settings' ? 'active' : ''}`}
          aria-label="Settings"
          onClick={() => setTab('settings')}
        >
          ⚙️
        </button>
      </nav>

      {tab === 'home' && (
        <HomeTab
          memories={memories}
          onChanged={refresh}
          pinnedCategories={pinnedCategories}
          userName={userName}
          onEnableLlm={startEngine}
        />
      )}
      {tab === 'brain' && (
        <BrainTab
          memories={memories}
          onChanged={refresh}
          pinnedCategories={pinnedCategories}
          onTogglePin={handleTogglePin}
        />
      )}
      {tab === 'settings' && (
        <SettingsTab
          signedInAs={signedInAs}
          storageUsage={storageUsage}
          onChanged={refresh}
          userName={userName}
          onNameChange={handleNameChange}
          llmState={llmState}
          loadProgress={loadProgress}
          onEnableLlm={startEngine}
        />
      )}
    </div>
  )
}

export default App
