import type { IconName } from '../components/icons'

const KEYWORD_ICONS: [RegExp, IconName][] = [
  [/health|doctor|medic|mom|dad|dose|medicine/i, 'heartCheck'],
  [/todo|task|checklist|chore/i, 'checkSquare'],
  [/expense|spend|budget|receipt|bill/i, 'receipt'],
  [/idea|project|energy|power|electric/i, 'bolt'],
  [/people|contact|friend|family/i, 'person'],
  [/wallet|money|finance|bank|card/i, 'wallet'],
  [/trip|travel|flight|vacation|bali|holiday/i, 'plane'],
  [/run|gym|fitness|workout|walk/i, 'shoe'],
]

/** Keyword-matched icon for a category label, falling back to a generic file icon. */
export function iconForCategory(category: string): IconName {
  for (const [re, icon] of KEYWORD_ICONS) {
    if (re.test(category)) return icon
  }
  return 'file'
}
