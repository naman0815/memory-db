import { useEffect, useState } from 'react'
import type { Memory, RetrievedMemory } from '../types'
import { getBlobUrl } from '../services/memories'
import { relatedMemories } from '../services/retriever'

export function MemoryCard({
  memory,
  score,
  onDelete,
}: {
  memory: Memory
  score?: number
  onDelete?: (id: string) => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [related, setRelated] = useState<RetrievedMemory[] | null>(null)

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

      {memory.text && <p>{memory.text}</p>}
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
          {memory.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
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
