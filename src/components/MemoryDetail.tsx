import { useEffect, useRef, useState } from 'react'
import type { Memory } from '../types'
import { getBlobUrl, updateMemoryText, deleteMemory } from '../services/memories'
import { flushOutbox } from '../services/sync'
import { Icon } from './icons'

const ICON_DELETE = `${import.meta.env.BASE_URL}icon-delete.png`

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
  const [draft, setDraft] = useState(memory.text)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(memory.text)
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

  function saveIfChanged() {
    if (draft !== memory.text) {
      updateMemoryText(memory.id, draft, onChanged)
      void flushOutbox()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  function handleClose() {
    saveIfChanged()
    onClose()
  }

  async function handleDelete() {
    await deleteMemory(memory.id)
    void flushOutbox()
    onChanged()
    onClose()
  }

  return (
    <div className="memory-detail-overlay" onClick={handleClose}>
      <div className="memory-detail" onClick={(e) => e.stopPropagation()}>
        <div className="memory-detail-head">
          <span className="type-badge">{memory.type}</span>
          <button type="button" className="icon-btn-inline" aria-label="Close" onClick={handleClose}>
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

        <textarea
          ref={textareaRef}
          className="memory-detail-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveIfChanged}
          placeholder="Note text…"
        />

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

        <div className="memory-detail-actions">
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
            <>
              <button type="button" onClick={saveIfChanged} disabled={draft === memory.text}>
                {saved ? 'Saved' : 'Save'}
              </button>
              <button type="button" className="secondary delete-btn" onClick={() => setConfirmingDelete(true)}>
                <img src={ICON_DELETE} alt="" className="delete-icon-img" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
