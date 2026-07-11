import { useState } from 'react'
import { verifyUnlock } from '../services/auth'

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [failed, setFailed] = useState(false)
  const [verifying, setVerifying] = useState(false)

  async function attempt() {
    setVerifying(true)
    setFailed(false)
    const ok = await verifyUnlock()
    setVerifying(false)
    if (ok) onUnlocked()
    else setFailed(true)
  }

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
