import { useState } from 'react'
import { maskSecrets } from '../services/secrets'

/** Renders text with any detected secret values dotted out; tap a dotted span to reveal it. */
export function MaskedText({ text }: { text: string }) {
  const segments = maskSecrets(text)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  if (!segments.some((s) => s.secret)) return <>{text}</>

  return (
    <>
      {segments.map((seg, i) =>
        seg.secret ? (
          <button
            key={i}
            type="button"
            className={`secret-span ${revealed.has(i) ? 'revealed' : ''}`}
            aria-label={revealed.has(i) ? 'Hide value' : 'Reveal value'}
            onClick={(e) => {
              e.stopPropagation()
              setRevealed((r) => {
                const next = new Set(r)
                if (next.has(i)) next.delete(i)
                else next.add(i)
                return next
              })
            }}
          >
            {revealed.has(i) ? seg.text : '••••••••'}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}
