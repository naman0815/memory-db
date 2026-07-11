import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null

/** Lazy singleton — the ~25MB model downloads on first use, then loads from cache. */
function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', EMBEDDING_MODEL, {
      // WASM works everywhere including iOS Safari; WebGPU not required for embeddings
      device: 'wasm',
      dtype: 'q8',
    })
  }
  return embedderPromise
}

export async function embed(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder()
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return new Float32Array(output.data as Float32Array)
}

/** Vectors are normalized, so cosine similarity is a plain dot product. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/** Warm the model in the background so first search isn't slow. */
export function preloadEmbedder(): void {
  getEmbedder().catch(() => {
    // Ignore — retried on first real embed call
    embedderPromise = null
  })
}
