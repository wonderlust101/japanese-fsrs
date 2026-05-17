/**
 * Shared data types for the Mistakes page. The page renders against
 * fixture data when the dev panel is on; otherwise it composes whatever
 * live signals exist (accuracy by layout, leech list if available) and
 * gracefully suppresses sections whose data isn't available yet.
 *
 * Lapse-bucket convention matches the IA brief: four bins, last bin
 * aligned with the leech threshold (default 8).
 */

import type { CardType, JLPTLevel } from '@fsrs-japanese/shared-types'

// ── Cards (rows shared by Problem Cards + Leeches) ─────────────────────────

export interface MistakeCard {
  /** Card UUID, for navigation to /cards/[id]. */
  id:           string
  word:         string
  reading:      string
  meaning:      string
  /** Number of lapses recorded against this card. */
  lapses:       number
  /** Last review rating, drives the small chip in the row. */
  lastResult:   'again' | 'hard' | 'good' | 'easy' | null
  /** Days since the card was first added. */
  ageDays:      number
  /** Days since the most recent review, null if never reviewed. */
  daysSinceLastReview: number | null
  /** FSRS card type (drives any future per-modality view; not surfaced in v1 UI). */
  cardType:     CardType
  /** JLPT level for context, optional. */
  jlptLevel?:   Exclude<JLPTLevel, 'beyond_jlpt'>
  /** Deck the card belongs to (for filtering). */
  deckId:       string
  deckName:     string
}

export interface LeechRow extends MistakeCard {
  /** ISO date the card became a leech. */
  flaggedAt:    string
  /** Optional teacher-voice diagnosis from the leech-detection pipeline. */
  diagnosis?:   string
}

// ── Confusables ────────────────────────────────────────────────────────────

export interface ConfusablePair {
  id:         string
  aWord:      string
  aReading:   string
  aCardId:    string
  bWord:      string
  bReading:   string
  bCardId:    string
  /** Number of times the user confused the two during the filter window. */
  confusions: number
}

// ── Card quality issues ────────────────────────────────────────────────────

export type QualityIssueKind =
  | 'missing-audio'
  | 'missing-sentence'
  | 'missing-kanji-breakdown'
  | 'missing-mnemonic'
  | 'missing-nuance'

export interface QualityIssue {
  kind:        QualityIssueKind
  /** Number of cards affected by this issue inside the filter window. */
  count:       number
}

// ── Lapse buckets (stem-and-leaf for Problem Cards) ────────────────────────

export interface LapseBucket {
  /** Inclusive lower bound of the lapse count for this bucket. */
  minLapses: number
  /** Inclusive upper bound; null for the open-ended "leech zone" bucket. */
  maxLapses: number | null
  /** Human-readable label e.g. "2–3" or "8+". */
  label:     string
  /** Card IDs that fall into this bucket (for drill-in). */
  cardIds:   ReadonlyArray<string>
}

/**
 * Canonical bucket spec mirroring the IA brief's Q14=C choice:
 * coarser four-bucket binning aligned with `LEECH_THRESHOLD=8`.
 */
export const LAPSE_BUCKET_SPEC: ReadonlyArray<{ minLapses: number; maxLapses: number | null; label: string }> = [
  { minLapses: 2, maxLapses: 3,    label: '2–3' },
  { minLapses: 4, maxLapses: 5,    label: '4–5' },
  { minLapses: 6, maxLapses: 7,    label: '6–7' },
  { minLapses: 8, maxLapses: null, label: '8+'  },
]

// ── Pattern Summary chips ──────────────────────────────────────────────────

export interface PatternChip {
  /** Anchor link inside the page (e.g. `#mistakes-leeches`). */
  href:  string
  /** Short mono small-caps label rendered before the value. */
  label: string
  /** Value rendered in sumi-ink (e.g. "14 cards"). */
  value: string
}

// ── Filters ────────────────────────────────────────────────────────────────

export type MistakesTimeRange = '7d' | '30d' | '90d' | 'all'

export interface MistakesFilters {
  /** Either a deck UUID, or "all" to skip the filter. */
  deckId:    string | 'all'
  timeRange: MistakesTimeRange
}

// ── Page state ─────────────────────────────────────────────────────────────

export type MistakesState = 'clean' | 'many' | 'leech-heavy' | 'not-enough'

// ── Aggregate page data ────────────────────────────────────────────────────

export interface MistakesData {
  state:             MistakesState
  /** Editorial diagnosis line for the Pattern Summary section. */
  patternDiagnosis:  string
  /** Pattern chips rendered next to the diagnosis. */
  chips:             ReadonlyArray<PatternChip>
  /** Problem card list (all cards with ≥2 lapses, sorted by lapse count desc). */
  problemCards:      ReadonlyArray<MistakeCard>
  /** Lapse-bucket aggregation derived from problemCards. */
  lapseBuckets:      ReadonlyArray<LapseBucket>
  /** Leeches in the current filter window. */
  leeches:           ReadonlyArray<LeechRow>
  /** Confusable pairs (empty array when backend signal isn't available). */
  confusables:       ReadonlyArray<ConfusablePair>
  /** Card quality issues aggregated by kind. */
  qualityIssues:     ReadonlyArray<QualityIssue>
  /** Total reviews inside the filter window (for the "not-enough" classifier). */
  totalReviews:      number
}

// ── Quality issue label vocabulary ─────────────────────────────────────────

export const QUALITY_ISSUE_LABEL: Readonly<Record<QualityIssueKind, string>> = {
  'missing-audio':           'Missing audio',
  'missing-sentence':        'Missing example sentence',
  'missing-kanji-breakdown': 'Missing kanji breakdown',
  'missing-mnemonic':        'Missing mnemonic',
  'missing-nuance':          'Missing nuance note',
}
