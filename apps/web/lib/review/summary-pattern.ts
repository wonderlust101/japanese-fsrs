import type { SessionSummary } from '@fsrs-japanese/shared-types'

// Six session-pattern keys, matching the Review Summary IA brief's
// "Primary Action Logic" table. The classifier reads the SessionSummary
// payload plus an out-of-band `endedEarly` signal (passed via query param
// from the session page when the learner taps "End session") and picks
// the pattern that best describes the session. State drives content
// (hero copy, diagnosis, recommended action) but never layout.

export type SessionPattern =
  | 'strong'
  | 'mixed'
  | 'difficult'
  | 'weakSpot'
  | 'ended-early'
  | 'no-pattern'

export interface PatternInputs {
  totalCards:  number
  accuracyPct: number
  again:       number
  hard:        number
  good:        number
  easy:        number
  leechCount:  number
  endedEarly:  boolean
}

export function inputsFromSummary(
  summary: SessionSummary,
  endedEarly: boolean,
): PatternInputs {
  return {
    totalCards:  summary.totalCards,
    accuracyPct: summary.accuracyPct,
    again:       summary.ratingBreakdown.again,
    hard:        summary.ratingBreakdown.hard,
    good:        summary.ratingBreakdown.good,
    easy:        summary.ratingBreakdown.easy,
    leechCount:  summary.weakSpots.length,
    endedEarly,
  }
}

// Ordered most-specific-first; first matching predicate wins.
export function classifySession(i: PatternInputs): SessionPattern {
  if (i.totalCards < 5)             return 'no-pattern'
  if (i.endedEarly)                 return 'ended-early'
  if (i.leechCount >= 3)            return 'weakSpot'
  if (i.accuracyPct < 65)           return 'difficult'
  if (i.again / i.totalCards > 0.25) return 'difficult'
  if (
    i.accuracyPct >= 90 &&
    i.leechCount === 0 &&
    i.again === 0
  )                                 return 'strong'
  return 'mixed'
}

// ── Content mapping ──────────────────────────────────────────────────────────
// One copy block per state. Hero copy lives on the page substrate, rationale
// frames the recommended action as a teacher's suggestion, and the action
// labels follow the IA brief's "Primary Action Logic" table. Routes are best-
// effort against the current router; missing destinations degrade to /today.

export type ActionRoute =
  | { kind: 'today' }
  | { kind: 'repair' }
  | { kind: 'review-problem'; cardIds: string[] }
  | { kind: 'insights' }

export interface SummaryContent {
  pattern:        SessionPattern
  kicker:         { kanji: string; label: string }
  heroHeadline:   string
  heroSubcopy?:   string | undefined
  diagnosisLead:  string
  diagnosisAside: string | null
  rationale:      string
  primary:        { label: string; route: ActionRoute }
  secondary?:     { label: string; route: ActionRoute } | undefined
  showProblemCards: boolean
  showTomorrowGlance: boolean
}

interface ContentInputs {
  inputs:       PatternInputs
  pattern:      SessionPattern
  leechIds:     string[]
  leechTokens:  string[]
}

export function buildSummaryContent(
  summary: SessionSummary,
  endedEarly: boolean,
): SummaryContent {
  const inputs  = inputsFromSummary(summary, endedEarly)
  const pattern = classifySession(inputs)
  const leechIds    = summary.weakSpots.map((l) => l.cardId)
  const leechTokens = summary.weakSpots.slice(0, 3).map((l) => l.word)
  return mapPattern({ inputs, pattern, leechIds, leechTokens })
}

function mapPattern({ inputs, pattern, leechIds, leechTokens }: ContentInputs): SummaryContent {
  const baseShow = {
    showProblemCards:    inputs.leechCount > 0,
    showTomorrowGlance:  true,
  }

  // Inline-Japanese specifics line. Stays null when there are no weakSpots.
  const specifics = leechTokens.length > 0
    ? `${formatTokens(leechTokens)} showed up in repeated misses.`
    : null

  switch (pattern) {
    case 'strong':
      return {
        pattern,
        kicker:         { kanji: '終', label: 'Session closed' },
        heroHeadline:   'Session closed. Nice rhythm today.',
        heroSubcopy:    undefined,
        diagnosisLead:  'No clear weak spot today.',
        diagnosisAside: null,
        rationale:      'Today reads as a strong session. Leave for today is fine.',
        primary:        { label: 'Leave for today', route: { kind: 'today' } },
        secondary:      undefined,
        showProblemCards:   false,
        showTomorrowGlance: true,
      }

    case 'mixed':
      return {
        pattern,
        kicker:         { kanji: '終', label: 'Session closed' },
        heroHeadline:   'Session closed.',
        diagnosisLead:  'A few rough spots, nothing alarming.',
        diagnosisAside: specifics,
        rationale:      'Most of the session held together. The few rough spots can wait until tomorrow.',
        primary:        { label: 'Leave for today', route: { kind: 'today' } },
        secondary:      inputs.leechCount > 0
          ? { label: 'Improve weak spots', route: { kind: 'repair' } }
          : undefined,
        ...baseShow,
      }

    case 'difficult':
      return {
        pattern,
        kicker:         { kanji: '終', label: 'Session closed' },
        heroHeadline:   'Session closed. That was a heavy one.',
        diagnosisLead:  'Recall sat lower than usual. A short focused drill will help.',
        diagnosisAside: specifics,
        rationale:      'A short drill on the cards below settles the rough spots without restarting the day.',
        primary:        leechIds.length > 0
          ? { label: 'Review weak spots', route: { kind: 'review-problem', cardIds: leechIds } }
          : { label: 'Open Insights', route: { kind: 'insights' } },
        secondary:      { label: 'Leave for today', route: { kind: 'today' } },
        ...baseShow,
      }

    case 'weakSpot':
      return {
        pattern,
        kicker:         { kanji: '終', label: 'Session closed' },
        heroHeadline:   'Session closed.',
        diagnosisLead:  'A handful of cards keep slipping. They look like weakSpots.',
        diagnosisAside: specifics,
        rationale:      'Repairing the cards below once is usually enough to break the loop.',
        primary:        { label: 'Improve weak spots', route: { kind: 'repair' } },
        secondary:      { label: 'Leave for today', route: { kind: 'today' } },
        ...baseShow,
      }

    case 'ended-early':
      return {
        pattern,
        kicker:         { kanji: '中', label: 'Session paused' },
        heroHeadline:   'Session closed. Picked up where it fit.',
        heroSubcopy:    'Partial sessions still count.',
        diagnosisLead:  inputs.leechCount > 0
          ? 'A short stop is fine; the rough spots will come back around.'
          : 'A short stop is fine. The schedule adjusts.',
        diagnosisAside: specifics,
        rationale:      'Stopping at a reasonable point is part of the practice. The remaining cards are still scheduled.',
        primary:        { label: 'Leave for today', route: { kind: 'today' } },
        secondary:      inputs.leechCount > 0
          ? { label: 'Improve weak spots', route: { kind: 'repair' } }
          : undefined,
        ...baseShow,
      }

    case 'no-pattern':
      return {
        pattern,
        kicker:         { kanji: '終', label: 'Session closed' },
        heroHeadline:   'Session closed.',
        diagnosisLead:  'Short session today.',
        diagnosisAside: 'Not enough cards to call a pattern.',
        rationale:      'Nothing requires action. Leave for today.',
        primary:        { label: 'Leave for today', route: { kind: 'today' } },
        secondary:      undefined,
        showProblemCards:   inputs.leechCount > 0,
        showTomorrowGlance: false,
      }
  }
}

// Comma-joined list with a final "and"; keeps the diagnosis sentence readable
// when more than two tokens appear (capped at three by the caller).
function formatTokens(tokens: string[]): string {
  const last = tokens[tokens.length - 1]
  if (last === undefined) return ''
  if (tokens.length === 1) return last
  if (tokens.length === 2) return `${tokens[0]} and ${tokens[1]}`
  return `${tokens.slice(0, -1).join(', ')}, and ${last}`
}
