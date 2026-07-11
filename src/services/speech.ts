/**
 * Web Speech API wrapper. Safari exposes it as webkitSpeechRecognition;
 * Firefox has no support — callers must check isSpeechSupported() and hide
 * the mic UI when false.
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechResultEventLike {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

function getCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined
}

export function isSpeechSupported(): boolean {
  return getCtor() !== undefined
}

export interface DictationHandle {
  stop(): void
}

export function startDictation(callbacks: {
  onTranscript: (text: string, isFinal: boolean) => void
  onEnd: () => void
  onError: (error: string) => void
}): DictationHandle {
  const Ctor = getCtor()
  if (!Ctor) throw new Error('Speech recognition not supported')

  const recognition = new Ctor()
  recognition.lang = navigator.language || 'en-US'
  recognition.interimResults = true
  recognition.continuous = false

  let finalTranscript = ''
  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) finalTranscript += result[0].transcript
      else interim += result[0].transcript
    }
    callbacks.onTranscript((finalTranscript + interim).trim(), false)
  }
  recognition.onerror = (event) => callbacks.onError(event.error)
  recognition.onend = () => {
    if (finalTranscript.trim()) callbacks.onTranscript(finalTranscript.trim(), true)
    callbacks.onEnd()
  }
  recognition.start()

  return { stop: () => recognition.stop() }
}
