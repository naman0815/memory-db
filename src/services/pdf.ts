import * as pdfjs from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker

const MAX_PAGES = 20

/** Extract text from a PDF blob (first 20 pages). */
export async function extractPdfText(blob: Blob): Promise<string> {
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise
  const pages = Math.min(doc.numPages, MAX_PAGES)
  const chunks: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    chunks.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }
  await doc.cleanup()
  return chunks.filter(Boolean).join('\n\n').trim()
}
