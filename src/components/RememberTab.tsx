import { useRef, useState } from 'react'
import type { Memory, MemoryType } from '../types'
import { saveMemory, attachExtractedText, deleteMemory } from '../services/memories'
import { findDuplicate } from '../services/enrich'
import { ocrImage } from '../services/ocr'
import { extractPdfText } from '../services/pdf'
import { startRecording, transcribeAudio, type RecorderHandle } from '../services/audio'
import { captionOptedIn, captionImage } from '../services/caption'
import { isSpeechSupported, startDictation, type DictationHandle } from '../services/speech'
import { flushOutbox } from '../services/sync'
import { MemoryCard } from './MemoryCard'

export function RememberTab({ memories, onChanged }: { memories: Memory[]; onChanged: () => void }) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [dictation, setDictation] = useState<DictationHandle | null>(null)
  const [recorder, setRecorder] = useState<RecorderHandle | null>(null)
  const [processing, setProcessing] = useState<string[]>([])
  const [dupWarning, setDupWarning] = useState<{ text: string; match: string } | null>(null)
  const [showContact, setShowContact] = useState(false)
  const [contact, setContact] = useState({ name: '', phone: '', email: '', notes: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  function track(label: string, work: Promise<void>) {
    setProcessing((p) => [...p, label])
    work.finally(() => setProcessing((p) => p.filter((l) => l !== label)))
  }

  async function persistText(text: string) {
    await saveMemory({ text })
    setInput('')
    setDupWarning(null)
    onChanged()
    void flushOutbox()
  }

  async function handleSave(force = false) {
    const text = input.trim()
    if (!text) return
    setSaving(true)
    try {
      if (!force) {
        const dup = await findDuplicate(text).catch(() => null)
        if (dup) {
          setDupWarning({ text, match: dup.memory.text || dup.memory.extractedText?.slice(0, 80) || dup.memory.type })
          return
        }
      }
      await persistText(text)
    } finally {
      setSaving(false)
    }
  }

  async function handleFile(file: File) {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const isAudio = file.type.startsWith('audio/')
    const type: MemoryType = isImage ? 'image' : isPdf ? 'pdf' : isAudio ? 'audio' : 'note'
    const memory = await saveMemory({ text: input.trim(), type, blob: file })
    setInput('')
    onChanged()
    void flushOutbox()

    if (isImage) {
      track(`Reading text from ${file.name}…`, (async () => {
        const [text, caption] = await Promise.all([
          ocrImage(file).catch(() => ''),
          captionOptedIn() ? captionImage(file).catch(() => undefined) : Promise.resolve(undefined),
        ])
        if (text || caption) await attachExtractedText(memory.id, text, caption)
        onChanged()
      })())
    } else if (isPdf) {
      track(`Extracting text from ${file.name}…`, (async () => {
        const text = await extractPdfText(file).catch(() => '')
        if (text) await attachExtractedText(memory.id, text)
        onChanged()
      })())
    } else if (isAudio) {
      transcribe(memory.id, file)
    }
  }

  function transcribe(memoryId: string, blob: Blob) {
    track('Transcribing audio…', (async () => {
      const text = await transcribeAudio(blob).catch(() => '')
      if (text) await attachExtractedText(memoryId, text)
      onChanged()
    })())
  }

  async function toggleVoiceMemo() {
    if (recorder) {
      const blob = await recorder.stop()
      setRecorder(null)
      const memory = await saveMemory({ text: input.trim(), type: 'audio', blob })
      setInput('')
      onChanged()
      void flushOutbox()
      transcribe(memory.id, blob)
      return
    }
    try {
      setRecorder(await startRecording())
    } catch {
      setProcessing((p) => [...p, 'Microphone access denied'])
      setTimeout(() => setProcessing((p) => p.filter((l) => l !== 'Microphone access denied')), 3000)
    }
  }

  function toggleDictation() {
    if (dictating) {
      dictation?.stop()
      return
    }
    setDictating(true)
    const handle = startDictation({
      onTranscript: (text) => setInput(text),
      onEnd: () => {
        setDictating(false)
        setDictation(null)
      },
      onError: () => {
        setDictating(false)
        setDictation(null)
      },
    })
    setDictation(handle)
  }

  async function saveContact() {
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(contact)) if (v.trim()) fields[k] = v.trim()
    if (!Object.keys(fields).length) return
    await saveMemory({ text: contact.name ? `Contact: ${contact.name}` : 'Contact', type: 'contact', fields })
    setContact({ name: '', phone: '', email: '', notes: '' })
    setShowContact(false)
    onChanged()
    void flushOutbox()
  }

  async function handleDelete(id: string) {
    await deleteMemory(id)
    onChanged()
    void flushOutbox()
  }

  return (
    <>
      <section className="capture">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSave()
            }
          }}
          placeholder="Type anything to remember — or attach an image, PDF, or audio"
          rows={3}
        />
        <div className="capture-actions">
          {isSpeechSupported() && (
            <button className={`mic ${dictating ? 'recording' : ''}`} onClick={toggleDictation}>
              {dictating ? '◼ Stop' : '🎤 Dictate'}
            </button>
          )}
          <button className={`mic ${recorder ? 'recording' : ''}`} onClick={toggleVoiceMemo}>
            {recorder ? '◼ Save memo' : '🎙 Voice memo'}
          </button>
          <button className="mic" onClick={() => fileRef.current?.click()}>
            📎 Attach
          </button>
          <button className="mic" onClick={() => setShowContact((s) => !s)}>
            👤 Contact
          </button>
          <button onClick={() => handleSave()} disabled={saving || !input.trim()}>
            {saving ? 'Saving…' : 'Remember'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,audio/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />

        {showContact && (
          <div className="contact-form">
            {(['name', 'phone', 'email', 'notes'] as const).map((k) => (
              <input
                key={k}
                placeholder={k}
                value={contact[k]}
                onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))}
              />
            ))}
            <button onClick={saveContact}>Save contact</button>
          </div>
        )}

        {dupWarning && (
          <div className="llm-banner">
            <p>
              Looks like you already stored this: “{dupWarning.match}”
            </p>
            <button onClick={() => persistText(dupWarning.text)}>Save anyway</button>
            <button className="mic" onClick={() => setDupWarning(null)}>
              Cancel
            </button>
          </div>
        )}

        {processing.map((label) => (
          <p key={label} className="llm-note">
            ⏳ {label}
          </p>
        ))}
      </section>

      <section className="memory-list">
        <h2>{memories.length} memories</h2>
        {memories.slice(0, 20).map((m) => (
          <MemoryCard key={m.id} memory={m} onDelete={handleDelete} />
        ))}
        {memories.length === 0 && <p className="empty">Nothing stored yet.</p>}
      </section>
    </>
  )
}
