import type { RetrievedMemory } from '../types'
import { embedText } from '../types'

// Qwen2.5-1.5B (~1GB+ runtime) was crashing Safari tabs, especially on phone —
// its per-tab memory ceiling is much tighter than desktop Chrome. 0.5B is
// ~4x lighter and loads in a fraction of the time.
export const LLM_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'

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

/** Drop the engine so the next call reloads fresh — call after any generation error. */
function resetEngine(): void {
  engine = null
  loadingPromise = null
}

/**
 * True when one memory clearly dominates the results — the case where a
 * direct lookup answer (the memory itself) is safer than letting a small
 * local LLM paraphrase it. Small models (0.5B class) are prone to swapping
 * digits in codes/numbers when asked to "answer" rather than quote.
 */
export function isDirectHit(retrieved: RetrievedMemory[]): boolean {
  if (retrieved.length === 0) return false
  if (retrieved.length === 1) return retrieved[0].score >= 0.5
  return retrieved[0].score >= 0.55 && retrieved[0].score - retrieved[1].score >= 0.1
}

const NUMBER_RE = /\d{2,}/g

/** Reject a generated answer if it contains numbers/codes not present anywhere in the source context. */
function containsFabricatedNumbers(answer: string, context: string): boolean {
  const answerNumbers = answer.match(NUMBER_RE) ?? []
  return answerNumbers.some((n) => !context.includes(n))
}

/**
 * Generate an answer grounded strictly in the retrieved memories.
 * Streams tokens to onToken; returns the full answer.
 */
/** One-shot short completion for enrichment tasks (tagging, classification). */
export async function quickComplete(prompt: string): Promise<string> {
  if (!engine) throw new Error('LLM engine not loaded')
  const res = await engine.chat.completions.create({
    temperature: 0.1,
    max_tokens: 48,
    messages: [{ role: 'user', content: prompt }],
  })
  return res.choices[0]?.message?.content ?? ''
}

export async function generateAnswer(
  question: string,
  retrieved: RetrievedMemory[],
  onToken: (partial: string) => void,
): Promise<string> {
  if (!engine) throw new Error('LLM engine not loaded')

  const context = retrieved
    .map((r, i) => `${i + 1}. [${new Date(r.memory.createdAt).toLocaleDateString()}] ${embedText(r.memory)}`)
    .join('\n')

  try {
    const chunks = await engine.chat.completions.create({
      stream: true,
      temperature: 0,
      max_tokens: 128,
      messages: [
        {
          role: 'system',
          content:
            'You answer questions using ONLY the stored memories provided. ' +
            'Numbers, codes, dates, and names MUST be copied character-for-character ' +
            'from the memories — never alter, guess, autocomplete, or invent a single digit. ' +
            'If a memory contains the answer, quote the relevant part directly. ' +
            'If the memories do not contain the answer, say exactly: "I don\'t have that stored." ' +
            'Be brief.',
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
    }
    if (containsFabricatedNumbers(full, context)) {
      throw new Error('Generated answer contained a number not present in source memories')
    }
    onToken(full)
    return full
  } catch (err) {
    // WebGPU device-lost / WASM OOM, or the fabrication guard above, surfaces
    // here rather than crashing the tab or showing a wrong fact — drop the
    // engine so the next question reloads it fresh.
    resetEngine()
    throw err
  }
}
