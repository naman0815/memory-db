import type { RetrievedMemory } from '../types'

export const LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

export type GeneratorStatus = 'unsupported' | 'not-downloaded' | 'loading' | 'ready' | 'error'

export interface LoadProgress {
  text: string
  progress: number // 0..1
}

type Engine = import('@mlc-ai/web-llm').MLCEngine

let engine: Engine | null = null
let loadingPromise: Promise<Engine> | null = null

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

const OPTED_IN_KEY = 'llm-opted-in'

export function hasOptedIn(): boolean {
  return localStorage.getItem(OPTED_IN_KEY) === 'true'
}

export function setOptedIn(value: boolean): void {
  localStorage.setItem(OPTED_IN_KEY, String(value))
}

/**
 * Load WebLLM + model weights (~1GB, one-time; cached by WebLLM via the
 * Cache API afterwards). The library itself is dynamically imported so the
 * main bundle stays small for devices that never enable this.
 */
export async function loadEngine(onProgress?: (p: LoadProgress) => void): Promise<Engine> {
  if (engine) return engine
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm')
      const e = await webllm.CreateMLCEngine(LLM_MODEL, {
        initProgressCallback: (report) =>
          onProgress?.({ text: report.text, progress: report.progress }),
      })
      engine = e
      return e
    })()
    loadingPromise.catch(() => {
      loadingPromise = null
    })
  }
  return loadingPromise
}

export function isEngineReady(): boolean {
  return engine !== null
}

/**
 * Generate an answer grounded strictly in the retrieved memories.
 * Streams tokens to onToken; returns the full answer.
 */
export async function generateAnswer(
  question: string,
  retrieved: RetrievedMemory[],
  onToken: (partial: string) => void,
): Promise<string> {
  if (!engine) throw new Error('LLM engine not loaded')

  const context = retrieved
    .map((r, i) => `${i + 1}. [${new Date(r.memory.createdAt).toLocaleDateString()}] ${r.memory.text}`)
    .join('\n')

  const chunks = await engine.chat.completions.create({
    stream: true,
    temperature: 0.2,
    max_tokens: 256,
    messages: [
      {
        role: 'system',
        content:
          'You answer questions using ONLY the stored memories provided. ' +
          'Be brief and direct. If the memories do not contain the answer, ' +
          'say exactly: "I don\'t have that stored." Never invent information.',
      },
      {
        role: 'user',
        content: `Stored memories:\n${context}\n\nQuestion: ${question}`,
      },
    ],
  })

  let full = ''
  for await (const chunk of chunks) {
    full += chunk.choices[0]?.delta?.content ?? ''
    onToken(full)
  }
  return full
}
