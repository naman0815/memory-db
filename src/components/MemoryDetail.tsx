import { useEffect, useState } from 'react'
import type { Memory } from '../types'
import { getBlobUrl, updateMemoryText, deleteMemory } from '../services/memories'
import { flushOutbox } from '../services/sync'
import { MaskedText } from './MaskedText'
import { Icon } from './icons'

export function MemoryDetail({
  memory,
  onClose,
  onChanged,
}: {
  memory: Memory
  onClose: () => void
  onChanged: () => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(memory.text)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    setDraft(memory.text)
    setEditing(false)
  }, [memory.id, memory.text])

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

  async function handleSave() {
    await updateMemoryText(memory.id, draft, onChanged)
    void flushOutbox()
    setEditing(false)
  }

  async function handleDelete() {
    await deleteMemory(memory.id)
    void flushOutbox()
    onChanged()
    onClose()
  }

  return (
    <div className="memory-detail-overlay" onClick={onClose}>
      <div className="memory-detail" onClick={(e) => e.stopPropagation()}>
        <div className="memory-detail-head">
          <span className="type-badge">{memory.type}</span>
          <button type="button" className="icon-btn-inline" aria-label="Close" onClick={onClose}>
            <Icon name="plus" size={20} />
          </button>
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
            <textarea className="edit-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="edit-actions">
              <button type="button" onClick={handleSave}>
                Save
              </button>
              <button
                type="button"
                className="secondary"
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
          memory.text && (
            <p className="memory-detail-text">
              <MaskedText text={memory.text} />
            </p>
          )
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
            <p className="extracted">{memory.extractedText}</p>
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
        </div>

        {!editing && (
          <div className="memory-detail-actions">
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            {confirmingDelete ? (
              <>
                <button type="button" className="danger" onClick={handleDelete}>
                  Confirm delete
                </button>
                <button type="button" className="secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
