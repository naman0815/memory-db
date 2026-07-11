import type { Memory, RetrievedMemory } from '../types'
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
 * digits in codes/numbers, or reframing a personal record as generic public
 * trivia, when asked to "answer" rather than quote.
 *
 * Single-result threshold matches retriever.ts's own SCORE_THRESHOLD (0.35)
 * — search() already filtered to relevant results, so if it's the only one
 * returned there's no reason to demand extra confidence before trusting it.
 */
export function isDirectHit(retrieved: RetrievedMemory[]): boolean {
  if (retrieved.length === 0) return false
  if (retrieved.length === 1) return retrieved[0].score >= 0.35
  return retrieved[0].score >= 0.55 && retrieved[0].score - retrieved[1].score >= 0.1
}

export const NOT_REMEMBERED = "I don't have that stored."

/**
 * Deterministic, personalized answer built directly from a memory's own
 * fields — no LLM involved. Used for direct hits so there's zero risk of a
 * small model reframing a personal ticket/note as generic public knowledge
 * (e.g. "The Odyssey was released on..." instead of "Your show is on...").
 */
export function buildDirectAnswer(memory: Memory): string {
  if (memory.eventDate) {
    const dt = new Date(memory.eventDate)
    const dateStr = dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const subject = memory.category && memory.category !== 'General' ? memory.category : memory.type
    return `Your ${subject} is on ${dateStr} at ${timeStr}.`
  }
  return memory.text || memory.caption || memory.extractedText?.slice(0, 300) || NOT_REMEMBERED
}

const NUMBER_RE = /\d{2,}/g
const STOPWORDS = new Set(
  'the a an is are was were be been being have has had do does did will would could should may might must can this that these those it its i my me you your he she they them their our we us not no yes with from into onto over under about for and or but if then than'.split(
    ' ',
  ),
)

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOPWORDS.has(w))
}

/**
 * Reject a generated answer unless it's actually grounded in the retrieved
 * memories: no number/code appears that isn't in the source context, and
 * the answer's substantive words meaningfully overlap with the context (a
 * cheap defense against the model answering something unrelated outright).
 * The refusal string itself always passes.
 */
function isGrounded(answer: string, context: string): boolean {
  if (answer.trim() === NOT_REMEMBERED) return true

  const answerNumbers = answer.match(NUMBER_RE) ?? []
  if (answerNumbers.some((n) => !context.includes(n))) return false

  const lowerContext = context.toLowerCase()
  const words = contentWords(answer)
  if (words.length === 0) return true // nothing substantive to check (e.g. "Yes.")
  const overlap = words.filter((w) => lowerContext.includes(w)).length
  return overlap / words.length >= 0.5
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
    .map((r, i) => {
      const eventLine = r.memory.eventDate
        ? ` | Event/show time: ${new Date(r.memory.eventDate).toLocaleString()}`
        : ''
      return `${i + 1}. [saved ${new Date(r.memory.createdAt).toLocaleDateString()}]${eventLine} ${embedText(r.memory)}`
    })
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
            'The stored memories below are your ONLY source of truth — you have no other ' +
            'knowledge of this person, their life, or the wider world, including public facts ' +
            'like movie release dates, celebrity info, or general trivia. Never answer as an ' +
            'encyclopedia. Always speak directly to the user about THEIR OWN record, using ' +
            '"you"/"your" (e.g. "Your show is on..." not "X was released on..."). If a memory ' +
            'has an event/show time, state the date AND time together. Numbers, codes, dates, ' +
            'and names MUST be copied character-for-character from the memories — never alter, ' +
            'guess, autocomplete, or invent a single digit or fact. If the memories do not answer ' +
            `the question, say EXACTLY: "${NOT_REMEMBERED}" and nothing else. Be brief.`,
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
    if (!isGrounded(full, context)) {
      throw new Error('Generated answer was not grounded in the source memories')
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
