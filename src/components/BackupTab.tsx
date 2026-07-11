import { useEffect, useState } from 'react'
import { syncConfigured, signInWithMagicLink, signOut, restoreFromCloud } from '../services/sync'
import { embedPending } from '../services/retriever'
import { captionOptedIn, setCaptionOptedIn } from '../services/caption'
import { isLockEnabled, isBiometricAvailable, enableLock, disableLock } from '../services/auth'

export function BackupTab({
  signedInAs,
  storageUsage,
  onChanged,
}: {
  signedInAs: string | null
  storageUsage: string | null
  onChanged: () => void
}) {
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
          <p className="empty">Signed in as {signedInAs}. New memories back up automatically (text + metadata; media files stay on-device for now).</p>
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

      <div className="capture" style={{ marginTop: 24 }}>
        <label className="llm-note" style={{ textAlign: 'left' }}>
          <input
            type="checkbox"
            checked={captions}
            onChange={(e) => {
              setCaptions(e.target.checked)
              setCaptionOptedIn(e.target.checked)
            }}
          />{' '}
          Auto-caption images (one-time ~250MB model download; makes photos searchable by what's in
          them)
        </label>
      </div>

      <div className="capture" style={{ marginTop: 16 }}>
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
