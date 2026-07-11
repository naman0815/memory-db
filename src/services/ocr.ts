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

/** Extract text from an image blob. Returns '' when nothing legible found. */
export async function ocrImage(blob: Blob): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(blob)
  // Drop low-confidence noise lines
  return data.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
    .join('\n')
    .trim()
}
