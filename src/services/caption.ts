import { pipeline, RawImage, type ImageToTextPipeline } from '@huggingface/transformers'

const OPTED_IN_KEY = 'caption-opted-in'

export function captionOptedIn(): boolean {
  return localStorage.getItem(OPTED_IN_KEY) === 'true'
}

export function setCaptionOptedIn(value: boolean): void {
  localStorage.setItem(OPTED_IN_KEY, String(value))
}

let captionerPromise: Promise<ImageToTextPipeline> | null = null

function getCaptioner(): Promise<ImageToTextPipeline> {
  if (!captionerPromise) {
    // ~250MB one-time download — hence the explicit opt-in
    captionerPromise = pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
      device: 'wasm',
      dtype: 'q8',
    })
    captionerPromise.catch(() => {
      captionerPromise = null
    })
  }
  return captionerPromise
}

/** Describe an image so it becomes semantically searchable. Requires opt-in. */
export async function captionImage(blob: Blob): Promise<string> {
  const captioner = await getCaptioner()
  const url = URL.createObjectURL(blob)
  try {
    const image = await RawImage.fromURL(url)
    const out = await captioner(image)
    const first = Array.isArray(out) ? out[0] : out
    const text = Array.isArray(first) ? first[0]?.generated_text : first?.generated_text
    return (text ?? '').trim()
  } finally {
    URL.revokeObjectURL(url)
  }
}
