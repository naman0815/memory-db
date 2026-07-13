import { useEffect, useState } from 'react'
import type { Memory, RetrievedMemory } from '../types'
import { getBlobUrl } from '../services/memories'
import { relatedMemories } from '../services/retriever'
import { MaskedText } from './MaskedText'

const ICON_DELETE = `${import.meta.env.BASE_URL}icon-delete.png`

export function MemoryCard({
  memory,
  score,
  onDelete,
  onOpen,
  onTagClick,
}: {
  memory: Memory
  score?: number
  onDelete?: (id: string) => void
  onOpen?: (memory: Memory) => void
  onTagClick?: (tag: string) => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [related, setRelated] = useState<RetrievedMemory[] | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Ticket/receipt screenshots are often tall (QR codes, long confirmation
  // text) — forcing them into the list's compact aspect ratio cropped real
  // content off the bottom. Collapsed-by-default with a tap-to-expand keeps
  // the list compact while still letting the full image render uncropped.
  const [imageExpanded, setImageExpanded] = useState(false)

  useEffect(() => {
    let url: string | null = null
    if (memory.blobId) {
      getBlobUrl(memory.blobId).then((u) => {
        url = u
        setMediaUrl(u)
      })
    }
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [memory.blobId])

  // Auto-revert an unconfirmed delete tap — matches MemoryDetail's own
  // tap-to-confirm delete instead of leaving this quick action as the one
  // place a memory can be deleted with zero confirmation.
  useEffect(() => {
    if (!confirmingDelete) return
    const t = setTimeout(() => setConfirmingDelete(false), 2500)
    return () => clearTimeout(t)
  }, [confirmingDelete])

  const isImage = memory.mimeType?.startsWith('image/')
  const isAudio = memory.mimeType?.startsWith('audio/')
  const isPdf = memory.mimeType === 'application/pdf'

  return (
    <div
      className={`memory-card ${onOpen ? 'clickable' : ''}`}
      onClick={() => onOpen?.(memory)}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="memory-meta">
        <span className="type-badge">{memory.type}</span>
        <div className="memory-meta-right">
          {memory.eventDate && <span>{new Date(memory.eventDate).toLocaleString()}</span>}
          {score !== undefined && score > 0 && <span className="score">{Math.round(score * 100)}% match</span>}
          {onDelete && (
            <button
              className={`card-delete ${confirmingDelete ? 'confirming' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (confirmingDelete) {
                  onDelete(memory.id)
                } else {
                  setConfirmingDelete(true)
                }
              }}
              aria-label={confirmingDelete ? 'Tap again to confirm delete' : 'Delete memory'}
            >
              <img src={ICON_DELETE} alt="" className="delete-icon-img" />
            </button>
          )}
        </div>
      </div>

      {isImage && mediaUrl && (
        <button
          type="button"
          className="media-toggle"
          onClick={(e) => {
            e.stopPropagation()
            setImageExpanded((v) => !v)
          }}
          aria-label={imageExpanded ? 'Collapse image' : 'Expand image'}
        >
          <img
            src={mediaUrl}
            alt={memory.caption ?? memory.text}
            className={`memory-media ${imageExpanded ? 'expanded' : 'collapsed'}`}
          />
        </button>
      )}
      {isAudio && mediaUrl && <audio controls src={mediaUrl} className="memory-media" onClick={(e) => e.stopPropagation()} />}
      {isPdf && mediaUrl && (
        <a href={mediaUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          Open PDF
        </a>
      )}

      {memory.text && (
        <p>
          <MaskedText text={memory.text} />
        </p>
      )}
      {memory.caption && <p className="caption">{memory.caption}</p>}
      {memory.url && (
        <a href={memory.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {memory.url}
        </a>
      )}
      {memory.fields && (
        <dl className="fields">
          {Object.entries(memory.fields).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {memory.entities?.amounts && memory.entities.amounts.length > 0 && (
        <p className="caption">Amount: {memory.entities.amounts.join(', ')}</p>
      )}
      {memory.extractedText && (
        <details onClick={(e) => e.stopPropagation()}>
          <summary>Extracted text</summary>
          <p className="extracted">{memory.extractedText.slice(0, 1000)}</p>
        </details>
      )}

      {memory.tags && memory.tags.length > 0 && (
        <div className="tags">
          {memory.tags.map((t) =>
            onTagClick ? (
              <button
                key={t}
                type="button"
                className="tag linkish"
                onClick={(e) => {
                  e.stopPropagation()
                  onTagClick(t)
                }}
              >
                #{t}
              </button>
            ) : (
              <span key={t} className="tag">
                #{t}
              </span>
            ),
          )}
        </div>
      )}

      <div className="memory-meta">
        <span>{new Date(memory.createdAt).toLocaleString()}</span>
        <span>
          <button
            className="linkish"
            onClick={(e) => {
              e.stopPropagation()
              if (related) setRelated(null)
              else relatedMemories(memory).then(setRelated)
            }}
          >
            {related ? 'hide related' : 'related'}
          </button>
        </span>
      </div>

      {related && (
        <div className="related" onClick={(e) => e.stopPropagation()}>
          {related.length === 0 && <p className="empty">No related memories.</p>}
          {related.map((r) => (
            <p key={r.memory.id} className="related-item">
              ↳ {r.memory.text || r.memory.caption || r.memory.extractedText?.slice(0, 60) || r.memory.type}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
