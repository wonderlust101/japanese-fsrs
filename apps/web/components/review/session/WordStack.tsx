'use client'

import { PitchGraph } from './PitchGraph'
import { cn } from '@/lib/utils'

interface WordStackProps {
  word:            string
  reading:         string | null
  meaning:         string
  partOfSpeech:    string | null
  jlptLevel:       string | null
  pitchPosition:   number | null
}

// The dictionary-headword stack (v4): pitch staff hovers above the kanji
// block; the kanji is the visual hero; reading sits beneath in kana with
// faded-sumi weight; definition is the third line in the body family.
// A small inline row beneath holds the audio button + POS + JLPT chip.
//
// The block is tightly bonded: no labels, no hairlines between the three
// headword lines. They read as one dictionary entry.
//
// The inline meta row beneath carries part-of-speech and JLPT level; it only
// renders when at least one of those is present.

export function WordStack({
  word,
  reading,
  meaning,
  partOfSpeech,
  jlptLevel,
  pitchPosition,
}: WordStackProps): React.JSX.Element {
  const hasPitch = pitchPosition !== null && reading !== null && reading !== ''
  const hasPos   = partOfSpeech !== null && partOfSpeech !== ''
  const hasJlpt  = jlptLevel !== null && jlptLevel !== ''

  return (
    <div className="flex w-full flex-col items-center gap-2 text-center">
      {/* Pitch staff hovering above the kanji. Centered horizontally. */}
      {hasPitch && (
        <PitchGraph reading={reading} pitchPosition={pitchPosition} />
      )}

      {/* Kanji hero */}
      <p
        lang="ja"
        className={cn(
          'font-japanese font-medium text-sumi-ink leading-[1.05]',
        )}
        style={{ fontSize: 'clamp(3rem, 7.5vw, 5.25rem)' }}
      >
        {word}
      </p>

      {/* Reading line. Only render when present *and* we don't already have
          the pitch staff carrying the reading (so the reading doesn't show
          twice). Falls back to plain reading when pitch is absent. */}
      {!hasPitch && reading !== null && reading !== '' && reading !== word && (
        // No pitch staff carrying the reading: the reading itself becomes
        // a real secondary line. Stronger color and a touch more size so it
        // doesn't read as a footnote when it's the sole pronunciation cue.
        <p
          lang="ja"
          className="font-japanese text-sumi-ink/70"
          style={{ fontSize: 'clamp(1.25rem, 2vw, 1.625rem)' }}
        >
          {reading}
        </p>
      )}

      {/* Definition: third line. Tight bond, no label. */}
      <p
        className="text-sumi-ink leading-snug max-w-measure-tight"
        style={{ fontSize: 'clamp(1.125rem, 1.5vw, 1.375rem)' }}
      >
        {meaning}
      </p>

      {/* Inline meta row beneath the headword. POS · JLPT. */}
      {(hasPos || hasJlpt) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {hasPos && (
            <span className="font-mono text-sm text-faded-sumi">
              {partOfSpeech}
            </span>
          )}
          {hasJlpt && (
            <span className="font-mono text-sm text-aizome-indigo/80">
              {jlptLevel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
