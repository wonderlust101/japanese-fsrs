import type { MistakesData, MistakesState } from './mistakesTypes'

/**
 * Interpretation builders for the Mistakes page. Per the IA brief and the
 * Q1 "field-notes" posture, every section opens with a sentence; this
 * file owns those sentences. Voice rules: editorial, specific, no em
 * dashes, no shaming, prefer "needs attention" over "bad."
 */

const NOT_ENOUGH_THRESHOLD = 50
const LEECH_HEAVY_THRESHOLD = 5

function withCommas(n: number): string {
  return n.toLocaleString('en-US')
}

export function classifyMistakes(
  data: Pick<MistakesData, 'problemCards' | 'leeches' | 'totalReviews'>,
): MistakesState {
  if (data.totalReviews < NOT_ENOUGH_THRESHOLD) return 'not-enough'
  if (data.leeches.length >= LEECH_HEAVY_THRESHOLD) return 'leech-heavy'
  if (data.problemCards.length === 0) return 'clean'
  return 'many'
}

export function buildHeaderLine(data: MistakesData): string {
  switch (data.state) {
    case 'clean':
      return 'Your collection is holding clean. Nothing flagged right now.'
    case 'many':
      return `${withCommas(data.problemCards.length)} cards need attention this window.`
    case 'leech-heavy':
      return `Repair will save more time than re-review right now. ${data.leeches.length} leeches in the pile.`
    case 'not-enough':
      return 'Mistake patterns need a few weeks of reviews to read.'
  }
}

export function buildProblemCardsLine(data: MistakesData): string {
  const trouble = data.problemCards.length
  const leech = data.leeches.length
  if (trouble === 0) return 'Nothing in the trouble zone.'
  if (leech === 0) {
    return `${withCommas(trouble)} cards are in the trouble zone, none past the leech threshold yet.`
  }
  return `${withCommas(trouble)} cards are in the trouble zone, ${leech} of them already past the leech threshold.`
}

export function buildLeechesLine(data: MistakesData): string {
  const n = data.leeches.length
  if (n === 0) return 'No leeches in this window.'
  if (n === 1) return 'One card has lapsed past the threshold. Repair is usually faster than persistent re-review.'
  return `${n} cards have lapsed past the threshold. Repair is usually faster than persistent re-review.`
}

export function buildConfusablesLine(data: MistakesData): string {
  const n = data.confusables.length
  if (n === 0) return 'No confusable pairs detected in this window.'
  if (n === 1) return 'You’ve recently mixed one pair up.'
  return `You’ve recently mixed ${n} pairs up.`
}

export function buildQualityLine(data: MistakesData): string {
  const total = data.qualityIssues.reduce((acc, q) => acc + q.count, 0)
  if (total === 0) return 'Every card has its support fields filled in.'
  return `${withCommas(total)} cards have at least one missing support field.`
}

export { NOT_ENOUGH_THRESHOLD, LEECH_HEAVY_THRESHOLD }
