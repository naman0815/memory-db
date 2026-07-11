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
 * Extract text from an image blob, keeping only lines tesseract itself is
 * confident about. Ticket/screenshot images often have QR codes, logos, and
 * stylized text that get misread as garbage ("858 oc =", "[wn] tf") —
 * confidence is a much more reliable filter for that than any string-shape
 * heuristic, since it's tesseract's own uncertainty signal rather than a
 * guess about what "looks wrong".
 *
 * Filtering happens per LINE, not per word: dropping individual low-scoring
 * words out of an otherwise-good line can silently truncate it — e.g. "Sun,
 * 19 July" losing just the "19" (a lone digit often scores lower than
 * surrounding letters) becomes "Sun, July", which then parses as a totally
 * different, wrong date instead of failing loudly. A whole kept line is
 * never partially eaten.
 */
export async function ocrImage(blob: Blob): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(blob, {}, { blocks: true, text: true })

  const lines: string[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.trim()
        if (line.confidence >= CONFIDENCE_THRESHOLD && /[a-zA-Z0-9]{2,}/.test(text)) {
          lines.push(text)
        }
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
