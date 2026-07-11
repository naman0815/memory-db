import { useEffect, useState } from 'react'
import { syncConfigured, signInWithMagicLink, signOut, restoreFromCloud } from '../services/sync'
import { embedPending } from '../services/retriever'
import { captionOptedIn, setCaptionOptedIn } from '../services/caption'
import { isLockEnabled, isBiometricAvailable, enableLock, disableLock } from '../services/auth'
import {
  isWebGPUSupported,
  hasOptedIn,
  setOptedIn,
  type LoadProgress,
} from '../services/generator'

export function SettingsTab({
  signedInAs,
  storageUsage,
  onChanged,
  userName,
  onNameChange,
  llmState,
  loadProgress,
  onEnableLlm,
}: {
  signedInAs: string | null
  storageUsage: string | null
  onChanged: () => void
  userName: string
  onNameChange: (name: string) => void
  llmState: 'unsupported' | 'off' | 'loading' | 'ready'
  loadProgress: LoadProgress | null
  onEnableLlm: () => void
}) {
  const [name, setName] = useState(userName)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [captions, setCaptions] = useState(captionOptedIn())
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [lockEnabled, setLockEnabled] = useState(isLockEnabled())
  const [lockStatus, setLockStatus] = useState<string | null>(null)

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable)
  }, [])

  async function toggleLock(next: boolean) {
    setLockStatus(null)
    if (next) {
      try {
        await enableLock()
        setLockEnabled(true)
        setLockStatus('Face ID lock enabled — you\'ll be asked to unlock next time you open the app.')
      } catch (err) {
        setLockStatus(`Couldn't enable Face ID: ${(err as Error).message}`)
      }
    } else {
      disableLock()
      setLockEnabled(false)
      setLockStatus('Face ID lock disabled.')
    }
  }

  async function handleSignIn() {
    try {
      await signInWithMagicLink(email.trim())
      setStatus(`Magic link sent to ${email.trim()} — open it on this device.`)
    } catch (err) {
      setStatus(`Sign-in failed: ${(err as Error).message}`)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setStatus(null)
    try {
      const count = await restoreFromCloud()
      onChanged()
      if (count > 0) {
        setStatus(`Restored ${count} memories. Rebuilding search index…`)
        await embedPending()
        setStatus(`Restored ${count} memories. Search index ready.`)
      } else {
        setStatus('Nothing new to restore — local store already has everything.')
      }
    } catch (err) {
      setStatus(`Restore failed: ${(err as Error).message}`)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <section className="backup">
      <div className="home-section-head">
        <h2>Your name</h2>
      </div>
      <div className="capture">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onNameChange(name)}
          placeholder="What should we call you?"
        />
      </div>

      <div className="home-section-head">
        <h2>Smart answers</h2>
      </div>
      {!isWebGPUSupported() ? (
        <p className="llm-note">Needs WebGPU (Safari 26+ / Chrome) — showing best-matching memories instead.</p>
      ) : llmState === 'loading' ? (
        <div className="llm-banner">
          <p>{loadProgress?.text ?? 'Preparing AI model…'}</p>
          <progress value={loadProgress?.progress ?? 0} max={1} />
        </div>
      ) : (
        <label className="llm-note" style={{ textAlign: 'left', display: 'block' }}>
          <input
            type="checkbox"
            checked={hasOptedIn()}
            onChange={(e) => {
              setOptedIn(e.target.checked)
              if (e.target.checked) onEnableLlm()
            }}
          />{' '}
          Enable AI-generated answers (one-time small model download; runs fully on this device)
        </label>
      )}

      <div className="home-section-head">
        <h2>Backup</h2>
      </div>
      {!syncConfigured && (
        <p className="empty">
          Backup isn't configured. Create a free Supabase project, run <code>supabase/schema.sql</code>{' '}
          in its SQL editor, and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      )}
      {syncConfigured && !signedInAs && (
        <div className="capture">
          <p className="empty">Sign in to back up your memories.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button onClick={handleSignIn} disabled={!email.trim()}>
            Send magic link
          </button>
        </div>
      )}
      {syncConfigured && signedInAs && (
        <div className="capture">
          <p className="empty">
            Signed in as {signedInAs}. New memories back up automatically (text + metadata; media files stay
            on-device for now).
          </p>
          <button onClick={handleRestore} disabled={restoring}>
            {restoring ? 'Restoring…' : 'Restore from backup'}
          </button>
          <button
            className="secondary"
            onClick={async () => {
              await signOut()
              setStatus('Signed out.')
            }}
          >
            Sign out
          </button>
        </div>
      )}
      {status && <p className="empty">{status}</p>}

      <div className="home-section-head">
        <h2>Photos</h2>
      </div>
      <div className="capture">
        <label className="llm-note" style={{ textAlign: 'left' }}>
          <input
            type="checkbox"
            checked={captions}
            onChange={(e) => {
              setCaptions(e.target.checked)
              setCaptionOptedIn(e.target.checked)
            }}
          />{' '}
          Auto-caption images (one-time ~250MB model download; makes photos searchable by what's in them)
        </label>
      </div>

      <div className="home-section-head">
        <h2>Privacy</h2>
      </div>
      <div className="capture">
        {biometricAvailable ? (
          <label className="llm-note" style={{ textAlign: 'left' }}>
            <input type="checkbox" checked={lockEnabled} onChange={(e) => toggleLock(e.target.checked)} /> Lock
            app with Face ID / Touch ID (gates opening the app; does not encrypt stored data)
          </label>
        ) : (
          <p className="llm-note">Face ID / Touch ID lock isn't available on this device or browser.</p>
        )}
        {lockStatus && <p className="empty">{lockStatus}</p>}
      </div>

      {storageUsage && <p className="llm-note">{storageUsage}</p>}
    </section>
  )
}
