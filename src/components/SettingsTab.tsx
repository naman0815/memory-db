import { useEffect, useState } from 'react'
import { syncConfigured, signInWithMagicLink, signOut, restoreFromCloud } from '../services/sync'
import { embedPending } from '../services/retriever'
import { captionOptedIn, setCaptionOptedIn } from '../services/caption'
import { isLockEnabled, isBiometricAvailable, enableLock, disableLock } from '../services/auth'
import { isWebGPUSupported, hasOptedIn, setOptedIn, type LoadProgress } from '../services/generator'
import { Toggle } from './Toggle'

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
        setLockStatus("You're all set — Face ID will ask next time you open the app.")
      } catch (err) {
        setLockStatus(`Couldn't turn this on: ${(err as Error).message}`)
      }
    } else {
      disableLock()
      setLockEnabled(false)
      setLockStatus('Face ID lock turned off.')
    }
  }

  async function handleSignIn() {
    try {
      await signInWithMagicLink(email.trim())
      setStatus(`Check ${email.trim()} for a sign-in link, then open it on this device.`)
    } catch (err) {
      setStatus(`Couldn't send that link: ${(err as Error).message}`)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setStatus(null)
    try {
      const count = await restoreFromCloud()
      onChanged()
      if (count > 0) {
        setStatus(`Restoring ${count} memories…`)
        await embedPending()
        setStatus(`Restored ${count} memories.`)
      } else {
        setStatus("You're already up to date — nothing new to restore.")
      }
    } catch (err) {
      setStatus(`Restore didn't work: ${(err as Error).message}`)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="home">
      <div className="home-section-head">
        <h2>Your name</h2>
      </div>
      <div className="settings-card">
        <input
          className="settings-name-input"
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
        <p className="settings-hint">
          Your browser can't run smart answers, so you'll just see the best-matching memories instead — that
          still works fine.
        </p>
      ) : llmState === 'loading' ? (
        <div className="settings-card">
          <p className="settings-progress-label">{loadProgress?.text ?? 'Getting things ready…'}</p>
          <progress value={loadProgress?.progress ?? 0} max={1} />
        </div>
      ) : (
        <label className="settings-card toggle-row">
          <div className="toggle-text">
            <div className="toggle-label">Write short answers</div>
            <div className="toggle-desc">
              Instead of a list of matches, get a short written answer. Downloads a small model once and runs
              entirely on this device.
            </div>
          </div>
          <Toggle
            ariaLabel="Write short answers"
            checked={hasOptedIn()}
            onChange={(checked) => {
              setOptedIn(checked)
              if (checked) onEnableLlm()
            }}
          />
        </label>
      )}

      <div className="home-section-head">
        <h2>Backup</h2>
      </div>
      {!syncConfigured && (
        <p className="settings-hint">
          Backup isn't set up yet. Once it is, your memories are safely copied to your own private cloud
          storage automatically.
        </p>
      )}
      {syncConfigured && !signedInAs && (
        <div className="settings-card">
          <p className="settings-card-note">Sign in to start backing up your memories.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button onClick={handleSignIn} disabled={!email.trim()}>
            Send sign-in link
          </button>
        </div>
      )}
      {syncConfigured && signedInAs && (
        <div className="settings-card">
          <p className="settings-card-note">
            Signed in as {signedInAs}. New memories back up automatically. Photos, PDFs, and audio stay on
            this device for now — everything else is backed up.
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
      {status && <p className="settings-hint">{status}</p>}

      <div className="home-section-head">
        <h2>Photos</h2>
      </div>
      <label className="settings-card toggle-row">
        <div className="toggle-text">
          <div className="toggle-label">Describe photos automatically</div>
          <div className="toggle-desc">
            So you can find a photo by what's in it, not just by what you typed. One-time ~250MB download.
          </div>
        </div>
        <Toggle
          ariaLabel="Describe photos automatically"
          checked={captions}
          onChange={(checked) => {
            setCaptions(checked)
            setCaptionOptedIn(checked)
          }}
        />
      </label>

      <div className="home-section-head">
        <h2>Privacy</h2>
      </div>
      {biometricAvailable ? (
        <label className="settings-card toggle-row">
          <div className="toggle-text">
            <div className="toggle-label">Require Face ID to open</div>
            <div className="toggle-desc">
              Asks for Face ID or Touch ID before you can use the app. This locks the screen — it doesn't
              encrypt what's stored.
            </div>
          </div>
          <Toggle ariaLabel="Require Face ID to open" checked={lockEnabled} onChange={toggleLock} />
        </label>
      ) : (
        <p className="settings-hint">Face ID isn't available on this device or browser.</p>
      )}
      {lockStatus && <p className="settings-hint">{lockStatus}</p>}

      {storageUsage && <p className="settings-hint">{storageUsage}</p>}
    </div>
  )
}
