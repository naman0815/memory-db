import { useEffect, useState } from 'react'
import { syncConfigured, generateSyncCode, setSyncCode, clearSyncCode, restoreFromCloud } from '../services/sync'
import { embedPending } from '../services/retriever'
import { isLockEnabled, isBiometricAvailable, enableLock, disableLock } from '../services/auth'
import { isWebGPUSupported, hasOptedIn, setOptedIn, type LoadProgress } from '../services/generator'
import { getThemePreference, setThemePreference, type ThemePreference } from '../services/theme'
import { Toggle } from './Toggle'
import { Icon } from './icons'

export function SettingsTab({
  syncCode,
  onSyncCodeChange,
  storageUsage,
  onChanged,
  userName,
  onNameChange,
  llmState,
  loadProgress,
  onEnableLlm,
}: {
  syncCode: string | null
  onSyncCodeChange: (code: string | null) => void
  storageUsage: string | null
  onChanged: () => void
  userName: string
  onNameChange: (name: string) => void
  llmState: 'unsupported' | 'off' | 'loading' | 'ready'
  loadProgress: LoadProgress | null
  onEnableLlm: () => void
}) {
  const [name, setName] = useState(userName)
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference)
  const [enteredCode, setEnteredCode] = useState('')
  const [newCode, setNewCode] = useState<string | null>(null)
  const [revealCode, setRevealCode] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
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

  function handleEnableBackup() {
    const code = generateSyncCode()
    setNewCode(code)
    setRevealCode(true)
    onSyncCodeChange(code)
  }

  function handleLinkDevice() {
    if (!enteredCode.trim()) return
    setSyncCode(enteredCode.trim())
    onSyncCodeChange(enteredCode.trim())
    setEnteredCode('')
    setStatus('Linked. Tap "Restore from backup" to pull in memories from your other device.')
  }

  function handleTurnOffBackup() {
    clearSyncCode()
    onSyncCodeChange(null)
    setNewCode(null)
    setStatus('Backup turned off on this device. Your existing backup is untouched.')
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

  function handleThemeChange(pref: ThemePreference) {
    setThemePreference(pref)
    setTheme(pref)
  }

  return (
    <div className="home tab-page">
      <div className="home-section-head">
        <h2>Appearance</h2>
      </div>
      <div className="settings-card">
        <div className="segmented">
          {(['light', 'dark', 'system'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={theme === option ? 'active' : ''}
              onClick={() => handleThemeChange(option)}
            >
              {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>

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
      {syncConfigured && !syncCode && (
        <div className="settings-card">
          <p className="settings-card-note">
            Backup uses a sync code instead of an account — whoever has the code can restore your
            memories on any device. Treat it like a password.
          </p>
          <button onClick={handleEnableBackup}>Turn on backup</button>
          <p className="settings-card-note" style={{ marginTop: 10 }}>
            Already have a code from another device?
          </p>
          <input
            type="text"
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value)}
            placeholder="Paste your sync code"
          />
          <button onClick={handleLinkDevice} disabled={!enteredCode.trim()}>
            Link this device
          </button>
        </div>
      )}
      {syncConfigured && syncCode && (
        <div className="settings-card">
          <p className="settings-card-note">
            Backup is on. New memories back up automatically. Photos, PDFs, and audio stay on this
            device for now — everything else is backed up.
          </p>
          {newCode && (
            <p className="settings-card-note">
              Save this sync code somewhere safe — it's the only way to restore on another device and
              won't be shown again after you leave this screen:
            </p>
          )}
          <div className="sync-code-row">
            <span className="sync-code-text">{revealCode ? syncCode : '•'.repeat(syncCode.length)}</span>
            <button
              type="button"
              className="icon-btn-inline"
              aria-label={revealCode ? 'Hide sync code' : 'Show sync code'}
              onClick={() => setRevealCode((v) => !v)}
            >
              <Icon name={revealCode ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
          <button onClick={handleRestore} disabled={restoring}>
            {restoring ? 'Restoring…' : 'Restore from backup'}
          </button>
          <button className="secondary" onClick={handleTurnOffBackup}>
            Turn off backup on this device
          </button>
        </div>
      )}
      {status && <p className="settings-hint">{status}</p>}

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
