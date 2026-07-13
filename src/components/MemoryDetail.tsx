import { useEffect, useRef, useState } from 'react'
import type { Memory } from '../types'
import {
  getBlobUrl,
  updateMemoryText,
  updateMemoryFields,
  updateMemoryExtractedText,
  updateMemoryCaption,
  deleteMemory,
} from '../services/memories'
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
  const [fieldsDraft, setFieldsDraft] = useState(memory.fields ?? {})
  const [extractedDraft, setExtractedDraft] = useState(memory.extractedText ?? '')
  const [captionDraft, setCaptionDraft] = useState(memory.caption ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Deliberately keyed on memory.id only, not memory.text: saving calls
    // onChanged(), which refetches memories and hands this component a new
    // memory object whose .text now equals what was just saved. If this
    // effect also re-ran on memory.text changing, any further typing done
    // between the save and that refetch landing would get silently
    // overwritten back to the saved value the moment it arrived. Same
    // reasoning applies to fields.
    setDraft(memory.text)
    setFieldsDraft(memory.fields ?? {})
    setExtractedDraft(memory.extractedText ?? '')
    setCaptionDraft(memory.caption ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory.id])

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

  const fieldsChanged =
    Object.keys(fieldsDraft).length !== Object.keys(memory.fields ?? {}).length ||
    Object.entries(fieldsDraft).some(([k, v]) => (memory.fields ?? {})[k] !== v)

  const extractedChanged = extractedDraft !== (memory.extractedText ?? '')
  const captionChanged = captionDraft !== (memory.caption ?? '')

  function saveIfChanged() {
    let changed = false
    if (draft !== memory.text) {
      updateMemoryText(memory.id, draft, onChanged)
      changed = true
    }
    if (fieldsChanged) {
      updateMemoryFields(memory.id, fieldsDraft, onChanged)
      changed = true
    }
    if (extractedChanged) {
      updateMemoryExtractedText(memory.id, extractedDraft, onChanged)
      changed = true
    }
    if (captionChanged) {
      updateMemoryCaption(memory.id, captionDraft, onChanged)
      changed = true
    }
    if (changed) {
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

        <input
          type="text"
          className="title-input"
          value={captionDraft}
          onChange={(e) => setCaptionDraft(e.target.value)}
          onBlur={saveIfChanged}
          placeholder="Title"
          aria-label="Title"
        />

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

        {memory.url && (
          <a href={memory.url} target="_blank" rel="noreferrer">
            {memory.url}
          </a>
        )}
        {memory.fields && (
          <dl className="fields fields-editable">
            {Object.entries(fieldsDraft).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => setFieldsDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                    onBlur={saveIfChanged}
                    aria-label={k}
                  />
                </dd>
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
            <textarea
              className="extracted-textarea"
              value={extractedDraft}
              onChange={(e) => setExtractedDraft(e.target.value)}
              onBlur={saveIfChanged}
              onClick={(e) => e.stopPropagation()}
              aria-label="Extracted text"
            />
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
              <button
                type="button"
                onClick={saveIfChanged}
                disabled={draft === memory.text && !fieldsChanged && !extractedChanged && !captionChanged}
              >
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
