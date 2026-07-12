import { useEffect, useRef, useState } from 'react'
import { verifyUnlock } from '../services/auth'

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [failed, setFailed] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const attempted = useRef(false)

  async function attempt() {
    setVerifying(true)
    setFailed(false)
    const ok = await verifyUnlock()
    setVerifying(false)
    if (ok) onUnlocked()
    else setFailed(true)
  }

  useEffect(() => {
    // Launching the installed PWA from the home screen icon is itself a
    // real user gesture, so Safari/Chrome often honor a WebAuthn call fired
    // right on mount without requiring a separate in-app tap first — saves
    // one full tap on the common path. If the browser doesn't count it as
    // a user gesture, the call just fails silently and the manual "Unlock"
    // button below still works as the fallback.
    if (attempted.current) return
    attempted.current = true
    void attempt()
  }, [])

  return (
    <div className="lock-screen tab-page">
      <h1 className="home-title">Brain 2</h1>
      <p className="llm-note">Locked with Face ID</p>
      <button onClick={attempt} disabled={verifying}>
        {verifying ? 'Verifying…' : 'Unlock'}
      </button>
      {failed && <p className="llm-note">Face ID didn't verify — try again.</p>}
    </div>
  )
}
