import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

export interface RecorderHandle {
  stop(): Promise<Blob>
}

/** Record a voice memo via MediaRecorder. Caller must handle permission errors. */
export async function startRecording(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  recorder.start()

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        recorder.stop()
      }),
  }
}

let whisperPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function getWhisper(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!whisperPromise) {
    // ~40MB one-time download, cached by the service worker afterwards
    whisperPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      device: 'wasm',
      dtype: 'q8',
    })
    whisperPromise.catch(() => {
      whisperPromise = null
    })
  }
  return whisperPromise
}

/** Transcribe an audio blob on-device with whisper-tiny. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const whisper = await getWhisper()
  // Decode to 16kHz mono PCM as whisper expects
  const ctx = new AudioContext({ sampleRate: 16000 })
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    const audio = decoded.getChannelData(0)
    const out = await whisper(audio)
    const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
    return text.trim()
  } finally {
    await ctx.close()
  }
}
