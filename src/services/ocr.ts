import { createWorker, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng')
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

const CONFIDENCE_THRESHOLD = 60

/**
 * Extract text from an image blob, keeping only words tesseract itself is
 * confident about. Ticket/screenshot images often have QR codes, logos, and
 * stylized text that get misread as garbage ("858 oc =", "[wn] tf") —
 * per-word confidence is a much more reliable filter for that than any
 * string-shape heuristic, since it's tesseract's own uncertainty signal
 * rather than a guess about what "looks wrong".
 */
export async function ocrImage(blob: Blob): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(blob, {}, { blocks: true, text: true })

  const lines: string[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words = line.words
          .filter((w) => w.confidence >= CONFIDENCE_THRESHOLD && /[a-zA-Z0-9]/.test(w.text))
          .map((w) => w.text)
        if (words.length) lines.push(words.join(' '))
      }
    }
  }

  // Fallback for environments where block-level data didn't come through
  if (lines.length === 0) {
    return data.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 1)
      .join('\n')
      .trim()
  }

  return lines.join('\n').trim()
}
