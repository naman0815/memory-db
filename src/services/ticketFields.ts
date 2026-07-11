/**
 * Deterministic, regex-only extraction of common ticket/receipt fields from
 * OCR'd text. No LLM involved — every value is a direct, verifiable
 * substring of the source text, so there's no fabrication surface. Only
 * covers well-structured formats (movie/event tickets); free-form notes or
 * receipts that don't match these shapes simply return no fields, which is
 * safer than guessing.
 */

const FIELD_PATTERNS: [string, RegExp][] = [
  ['Booking ID', /booking\s*id\D*?([A-Z0-9]{5,12})\b/i],
  ['PNR', /\bpnr\D*?([A-Z0-9]{5,10})\b/i],
  ['Screen', /\bscreen\b\D*?\b(imax|3d|2d|4dx|dolby[\s-]?atmos)\b/i],
  ['Seats', /\b([A-Z]\d{1,3}(?:\s*,\s*[A-Z]\d{1,3})+)\b/i],
]

export function extractTicketFields(text: string): Record<string, string> | undefined {
  const fields: Record<string, string> = {}
  for (const [label, pattern] of FIELD_PATTERNS) {
    const match = text.match(pattern)
    if (match) fields[label] = match[1].trim()
  }
  return Object.keys(fields).length > 0 ? fields : undefined
}
