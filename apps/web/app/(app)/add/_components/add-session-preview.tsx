'use client'

import { useMemo } from 'react'

import type { ApiDueCard, ExampleSentence } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { CardFront } from '@/components/review/session/CardFront'
import { cn } from '@/lib/utils'

// ── Empty-state quotes ────────────────────────────────────────────────────────

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
// /add captures only the *front* of the eventual card: word + sentence. The
// rest of the back-of-card content (reading, meaning, mnemonic, picture) is
// filled on /add/review. The preview therefore renders only `CardFront`; a
// Front/Back toggle would have nothing to show on the back. If we ever bring
// back-of-card capture to /add, the toggle pattern is preserved in git
// history.

const PREVIEW_CARD_ID = 'add-preview-card'
const PREVIEW_DECK_ID = 'add-preview-deck'

interface PreviewFieldsData {
  word:              string
  reading:           string
  meaning:           string
  exampleSentences?: ExampleSentence[]
}

interface BuildPreviewCardInput {
  word:     string
  sentence: string
}

function buildPreviewCard({ word, sentence }: BuildPreviewCardInput): ApiDueCard {
  const fieldsData: PreviewFieldsData = {
    word,
    reading: '',
    meaning: '',
  }

  if (sentence.length > 0) {
    fieldsData.exampleSentences = [{ ja: sentence, en: '', furigana: sentence }]
  }

  return {
    id:         PREVIEW_CARD_ID,
    deckId:     PREVIEW_DECK_ID,
    jlptLevel:  null,
    state:      0,
    due:        new Date().toISOString(),
    layoutType: 'vocabulary',
    fieldsData,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface AddSessionPreviewProps {
  word:           string
  sentence:       string
  todayKey:       string
  dimmed?:        boolean
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

  const previewCard = useMemo<ApiDueCard | null>(() => {
    if (!hasWord) return null
    return buildPreviewCard({ word, sentence })
  }, [hasWord, word, sentence])

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        dimmed && 'opacity-80 transition-opacity duration-200 ease-out',
      )}
    >
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

function EmptyPreview({ quote }: { quote: string }): React.JSX.Element {
  return (
    <div className="flex w-full flex-col items-center gap-6 md:gap-8 py-4 md:py-8 min-h-[180px] justify-center">
      <p className="max-w-[28ch] text-center font-display text-lg leading-relaxed text-faded-sumi md:text-xl">
        “{quote}”
      </p>
    </div>
  )
}

export function isTargetMissingFromSentence(word: string, sentence: string): boolean {
  if (word.length === 0 || sentence.length === 0) return false
  return !sentence.toLowerCase().includes(word.toLowerCase())
}
