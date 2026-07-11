import { createWorker, type Worker } from 'tesseract.js'
import * as chrono from 'chrono-node'

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
 *
 * A whole date/time line can still legitimately score below the confidence
 * bar (smaller or differently-styled text near ticket art tends to) — that
 * observed in practice: a ticket's "Sun, 19 July" line was dropped entirely,
 * leaving only a bare "8:10 AM" behind, which then resolved to the wrong
 * date downstream. So a line chrono can independently parse a date/time
 * out of is always kept regardless of its confidence score — losing a date
 * is a worse failure than keeping one extra borderline line.
 */
export async function ocrImage(blob: Blob): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(blob, {}, { blocks: true, text: true })

  const lines: string[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.trim()
        const looksLikeDateOrTime = chrono.parse(text).length > 0
        if ((line.confidence >= CONFIDENCE_THRESHOLD || looksLikeDateOrTime) && /[a-zA-Z0-9]{2,}/.test(text)) {
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
