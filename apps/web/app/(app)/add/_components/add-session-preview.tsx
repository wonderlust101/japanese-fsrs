'use client'

import { useMemo, useState } from 'react'

import type { ApiDueCard, ExampleSentence } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { CardBack } from '@/components/review/session/CardBack'
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
// The session's CardFront / CardBack consume an ApiDueCard via
// `resolveCardFields(card)`. This is the single point /add knows about the
// session card's data shape; future schema changes touch this function alone.

const PREVIEW_CARD_ID = 'add-preview-card'
const PREVIEW_DECK_ID = 'add-preview-deck'

interface PreviewFieldsData {
  word:              string
  reading:           string
  meaning:           string
  exampleSentences?: ExampleSentence[]
  picture?:          string
}

interface BuildPreviewCardInput {
  word:           string
  sentence:       string
  reading:        string
  meaning:        string
  pictureDataUrl: string | null
}

function buildPreviewCard({
  word,
  sentence,
  reading,
  meaning,
  pictureDataUrl,
}: BuildPreviewCardInput): ApiDueCard {
  const fieldsData: PreviewFieldsData = {
    word,
    reading,
    meaning,
  }

  if (sentence.length > 0) {
    fieldsData.exampleSentences = [{ ja: sentence, en: '', furigana: sentence }]
  }

  if (pictureDataUrl !== null) {
    fieldsData.picture = pictureDataUrl
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

type PreviewFace = 'front' | 'back'

export interface AddSessionPreviewProps {
  word:           string
  sentence:       string
  /** Optional kana reading (from the "Back of card" tab). Surfaces only on
   *  the back face of the preview. */
  reading:        string
  /** Optional English meaning (from the "Back of card" tab). Surfaces only on
   *  the back face. */
  meaning:        string
  /** Optional data-URL preview of the user's uploaded picture. Surfaces only
   *  on the back face. Never sent to the server in this iteration. */
  pictureDataUrl: string | null
  todayKey:       string
  dimmed?:        boolean
  targetMissing?: boolean
}

export function AddSessionPreview({
  word,
  sentence,
  reading,
  meaning,
  pictureDataUrl,
  todayKey,
  dimmed = false,
  targetMissing = false,
}: AddSessionPreviewProps): React.JSX.Element {
  const quote = useMemo(() => pickPreviewLine(todayKey), [todayKey])
  const [face, setFace] = useState<PreviewFace>('front')

  const hasWord = word.length > 0

  const previewCard = useMemo<ApiDueCard | null>(() => {
    if (!hasWord) return null
    return buildPreviewCard({ word, sentence, reading, meaning, pictureDataUrl })
  }, [hasWord, word, sentence, reading, meaning, pictureDataUrl])

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        dimmed && 'opacity-80 transition-opacity duration-200 ease-out',
      )}
    >
      <SectionCard
        kanji=""
        label=""
        stripeTone="brand"
        omitTitle
        {...(hasWord ? { rightContent: <FaceToggle face={face} onChange={setFace} /> } : {})}
      >
        <div
          aria-live="polite"
          aria-atomic="true"
          className="px-1 pt-5 pb-6 md:px-2 md:pt-7 md:pb-8"
        >
          {previewCard !== null ? (
            face === 'front'
              ? <CardFront card={previewCard} />
              : <CardBack key={`back-${reading}-${meaning}-${pictureDataUrl ?? ''}`} card={previewCard} />
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

// ── Sub-components ────────────────────────────────────────────────────────────

interface FaceToggleProps {
  face:     PreviewFace
  onChange: (next: PreviewFace) => void
}

function FaceToggle({ face, onChange }: FaceToggleProps): React.JSX.Element {
  const items: ReadonlyArray<{ value: PreviewFace; label: string }> = [
    { value: 'front', label: 'Front' },
    { value: 'back',  label: 'Back'  },
  ]
  return (
    <div
      role="tablist"
      aria-label="Preview face"
      className="pointer-events-auto inline-flex items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised"
    >
      {items.map((item) => {
        const selected = item.value === face
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              'px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em]',
              'transition-colors duration-150 ease-out',
              'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              selected
                ? 'bg-cream-inset text-sumi-ink'
                : 'text-faded-sumi hover:text-sumi-ink',
            )}
          >
            {item.label}
          </button>
        )
      })}
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

// ── Target-in-sentence check (re-exported, unchanged) ────────────────────────

export function isTargetMissingFromSentence(word: string, sentence: string): boolean {
  if (word.length === 0 || sentence.length === 0) return false
  return !sentence.toLowerCase().includes(word.toLowerCase())
}
