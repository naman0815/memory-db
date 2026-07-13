/**
 * Deterministic, keyword-based secret detection for note previews —
 * "the wifi password is Xk29!qz" gets its value dotted out in list/preview
 * contexts so a shoulder-surfer can't read it off the screen, without
 * touching the stored text: masking is purely a render-layer concern.
 * Search/embedding/AI answers always operate on the real, unmasked text —
 * asking "what's my wifi password" must still work.
 */

const KEYWORD = /\b(passwords?|passwd|pwd|passcodes?|pins?|secrets?|api[\s-]?keys?|access[\s-]?codes?|otps?)\b(\s*(?:is|are|:|-|=)?\s*)(\S+)/gi

export interface TextSegment {
  text: string
  secret: boolean
}

/** Splits text into plain/secret segments — the secret segments are the values, not the keywords. */
export function maskSecrets(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let lastIndex = 0
  KEYWORD.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = KEYWORD.exec(text))) {
    const [, keyword, sep, value] = match
    const valueStart = match.index + keyword.length + sep.length
    const valueEnd = valueStart + value.length
    if (valueStart > lastIndex) segments.push({ text: text.slice(lastIndex, valueStart), secret: false })
    segments.push({ text: text.slice(valueStart, valueEnd), secret: true })
    lastIndex = valueEnd
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), secret: false })
  return segments.length ? segments : [{ text, secret: false }]
}

export function hasSecret(text: string): boolean {
  return maskSecrets(text).some((s) => s.secret)
}

/** Plain-string redaction for compact, non-interactive preview labels (card titles, list rows). */
export function redactForPreview(text: string): string {
  return maskSecrets(text)
    .map((s) => (s.secret ? '••••••••' : s.text))
    .join('')
}
