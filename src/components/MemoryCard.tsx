import { useEffect, useState } from 'react'
import type { Memory, RetrievedMemory } from '../types'
import { getBlobUrl } from '../services/memories'
import { relatedMemories } from '../services/retriever'

export function MemoryCard({
  memory,
  score,
  onDelete,
  onEdit,
  onTagClick,
}: {
  memory: Memory
  score?: number
  onDelete?: (id: string) => void
  onEdit?: (id: string, text: string) => void
  onTagClick?: (tag: string) => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [related, setRelated] = useState<RetrievedMemory[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(memory.text)

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

  const isImage = memory.mimeType?.startsWith('image/')
  const isAudio = memory.mimeType?.startsWith('audio/')
  const isPdf = memory.mimeType === 'application/pdf'

  return (
    <div className="memory-card">
      <div className="memory-meta">
        <span className="type-badge">{memory.type}</span>
        {memory.eventDate && <span>{new Date(memory.eventDate).toLocaleString()}</span>}
        {score !== undefined && score > 0 && <span className="score">{Math.round(score * 100)}% match</span>}
      </div>

      {isImage && mediaUrl && <img src={mediaUrl} alt={memory.caption ?? memory.text} className="memory-media" />}
      {isAudio && mediaUrl && <audio controls src={mediaUrl} className="memory-media" />}
      {isPdf && mediaUrl && (
        <a href={mediaUrl} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      )}

      {editing ? (
        <div className="edit-row">
          <textarea
            className="edit-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="edit-actions">
            <button
              type="button"
              className="linkish"
              onClick={() => {
                onEdit?.(memory.id, draft)
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setDraft(memory.text)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        memory.text && <p>{memory.text}</p>
      )}
      {memory.caption && <p className="caption">{memory.caption}</p>}
      {memory.url && (
        <a href={memory.url} target="_blank" rel="noreferrer">
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
        <details>
          <summary>Extracted text</summary>
          <p className="extracted">{memory.extractedText.slice(0, 1000)}</p>
        </details>
      )}

      {memory.tags && memory.tags.length > 0 && (
        <div className="tags">
          {memory.tags.map((t) =>
            onTagClick ? (
              <button key={t} type="button" className="tag linkish" onClick={() => onTagClick(t)}>
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
            onClick={() => {
              if (related) setRelated(null)
              else relatedMemories(memory).then(setRelated)
            }}
          >
            {related ? 'hide related' : 'related'}
          </button>
          {onEdit && !editing && (
            <button className="linkish" onClick={() => setEditing(true)}>
              edit
            </button>
          )}
          {onDelete && (
            <button className="delete" onClick={() => onDelete(memory.id)} aria-label="Delete memory">
              ×
            </button>
          )}
        </span>
      </div>

      {related && (
        <div className="related">
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
