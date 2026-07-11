/**
 * Heuristic note-vs-question classifier for the merged capture/ask input.
 * Deliberately simple and over-inclusive on the "question" side — the UI
 * always shows the detected mode before submitting, so a wrong guess is a
 * one-tap fix, not a silent mistake.
 */
const QUESTION_STARTERS =
  /^(what|when|where|who|whom|whose|why|how|is|are|was|were|do|does|did|can|could|should|would|will|has|have|had)\b/i

export function looksLikeQuestion(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.endsWith('?')) return true
  return QUESTION_STARTERS.test(t)
}
