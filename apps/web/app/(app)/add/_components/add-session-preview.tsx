'use client'

import { useMemo } from 'react'

import type { ApiDueCard, ExampleSentence } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { CardFront } from '@/components/review/session/CardFront'
import { cn } from '@/lib/utils'

// ── Empty-state quotes ────────────────────────────────────────────────────────
//
// Date-seeded teacher-voice line that occupies the card body when nothing has
// been typed yet. Same hash-by-seed cadence as today-hero's PREPARATION_LINES.

const PREVIEW_LINES = [
  'A word, a sentence, a card.',
  'Capture once. Remember many times.',
  'Write the word. Tomo holds it.',
  'Catch it before the day moves on.',
  "What you save here is what you'll see again.",
] as const

const DEFAULT_PREVIEW_LINE: string = PREVIEW_LINES[0]

function pickPreviewLine(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PREVIEW_LINES[hash % PREVIEW_LINES.length] ?? DEFAULT_PREVIEW_LINE
}

// ── Synthetic card builder ────────────────────────────────────────────────────
//
// The session's `CardFront` consumes an `ApiDueCard` and reads it through
// `resolveCardFields(card)`. To render a faithful forecast of the eventual
// card, we construct the smallest possible card object from the in-progress
// draft. Non-content fields (FSRS state, ids, timestamps) are stable
// placeholders — `CardFront` never reads them.
//
// Centralising the construction here is the *only* point where /add knows
// anything about the session card's data shape; future schema changes touch
// this function and nothing else in /add.

const PREVIEW_CARD_ID = 'add-preview-card'
const PREVIEW_DECK_ID = 'add-preview-deck'

interface BuildPreviewCardInput {
  word:     string
  sentence: string
}

interface PreviewFieldsData {
  word:              string
  reading:           string
  meaning:           string
  exampleSentences?: ExampleSentence[]
}

function buildPreviewCard({ word, sentence }: BuildPreviewCardInput): ApiDueCard {
  const fieldsData: PreviewFieldsData = {
    word,
    reading: '',
    meaning: '',
  }

  if (sentence.length > 0) {
    fieldsData.exampleSentences = [
      { ja: sentence, en: '', furigana: sentence },
    ]
  }

  return {
    id:         PREVIEW_CARD_ID,
    deckId:     PREVIEW_DECK_ID,
    cardType:   'comprehension',
    jlptLevel:  null,
    state:      0,
    due:        new Date().toISOString(),
    layoutType: 'vocabulary',
    fieldsData,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface AddSessionPreviewProps {
  /** Trimmed word. Empty string means "no word yet." */
  word:     string
  /** Trimmed sentence. Empty string means "no sentence yet." */
  sentence: string
  /** Date key used to seed the empty-state quote. `yyyy-mm-dd`. */
  todayKey: string
  /** When true, applies a soft opacity dim to telegraph the submitting state. */
  dimmed?:  boolean
  /** When true, the target word was not found in the sentence — surface the
   *  footnote below the preview. Caller decides; we only render. */
  targetMissing?: boolean
}

export function AddSessionPreview({
  word,
  sentence,
  todayKey,
  dimmed = false,
  targetMissing = false,
}: AddSessionPreviewProps): React.JSX.Element {
  const quote = useMemo(() => pickPreviewLine(todayKey), [todayKey])

  const hasWord = word.length > 0

  // Synthetic card is only constructed when there's content. The empty state
  // is rendered explicitly so we don't pass an empty headword into VocabHero
  // (which would collapse the layout).
  const previewCard = useMemo<ApiDueCard | null>(() => {
    if (!hasWord) return null
    return buildPreviewCard({ word, sentence })
  }, [hasWord, word, sentence])

  return (
    <div className={cn('flex flex-col gap-3', dimmed && 'opacity-80 transition-opacity duration-200 ease-out')}>
      <SectionCard kanji="" label="" stripeTone="brand" omitTitle>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="px-1 pt-5 pb-6 md:px-2 md:pt-7 md:pb-8"
        >
          {previewCard !== null ? (
            <CardFront card={previewCard} />
          ) : (
            <EmptyPreview quote={quote} />
          )}
        </div>
      </SectionCard>

      {targetMissing && (
        <p
          role="status"
          className="px-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi"
        >
          Target not found in your sentence. Tomo will still try.
        </p>
      )}
    </div>
  )
}

// ── Empty-state body ──────────────────────────────────────────────────────────
//
// Matches CardFront's outer rhythm (`flex flex-col items-center gap-8 md:gap-10
// py-4 md:py-8`) so the card frame doesn't collapse when there's no content.
// Quote sits centered in faded-sumi display register.

function EmptyPreview({ quote }: { quote: string }): React.JSX.Element {
  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8 py-4 md:py-8 min-h-[180px] justify-center">
      <p className="max-w-[28ch] text-center font-display text-lg leading-relaxed text-faded-sumi md:text-xl">
        “{quote}”
      </p>
    </div>
  )
}

// ── Target-in-sentence check ──────────────────────────────────────────────────
//
// Exposed so the caller (AddClient) can decide whether to pass `targetMissing`
// AND whether to suppress its form-level empty-sentence warning. Kept here so
// the matching rule lives next to the rendering rule.

export function isTargetMissingFromSentence(word: string, sentence: string): boolean {
  if (word.length === 0 || sentence.length === 0) return false
  return !sentence.toLowerCase().includes(word.toLowerCase())
}
