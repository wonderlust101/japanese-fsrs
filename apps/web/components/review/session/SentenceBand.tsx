'use client'

import { useState } from 'react'

import type { FuriganaMode } from '@/stores/useSessionPreferencesStore'
import { cn } from '@/lib/utils'
import { useSentenceSwapKey } from './useSentenceSwapKey'

// Inline reveal-hint glyph. Eye outline (12×12, currentColor stroke) sits
// before the blurred translation as an unmistakable "tap to reveal" cue.
// Hidden once revealed. The blur itself + cursor-pointer remain, but this
// glyph is the explicit affordance for users who haven't met the pattern.
function RevealEyeGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block align-[-0.15em] mr-1.5 shrink-0 text-faded-sumi"
    >
      <path d="M1.5 7s2-3.5 5.5-3.5S12.5 7 12.5 7s-2 3.5-5.5 3.5S1.5 7 1.5 7z" />
      <circle cx="7" cy="7" r="1.6" />
    </svg>
  )
}

interface SentenceBandProps {
  ja:                     string
  furigana?:              string
  en?:                    string
  furiganaMode:           FuriganaMode
  /** When true, the English translation renders unblurred. When false
   *  (default), it sits behind a blur until the learner taps to reveal
   *  it — preserves the recall rep on the back of the card. */
  autoRevealTranslation?: boolean
  /** Identifies which sentence this is (the example index). When it changes,
   *  the band replays its entrance as a "sentence switched" cue. Drive it from
   *  the pager index, not the text, so live edits don't retrigger it. Omit
   *  where there's no pager (review session) to disable the cue. */
  swapToken?:             number | undefined
}

// Sentence + furigana band. Furigana mode comes from the learner's session
// preferences:
//   - 'always': reading line is visible above the sentence
//   - 'hover':  reading hidden by default, revealed on hover (desktop) or
//               tap-to-toggle (mobile and any pointer-coarse environment)
//   - 'off':    reading never rendered
//
// The furigana field is a whole-sentence kana reading, not a per-token
// alignment, so it can't drive precise per-kanji <ruby>. We therefore render
// it as a separate reading line stacked above the sentence rather than as one
// giant <ruby> over the whole base. Both the reading and the sentence are then
// plain CJK text, which wraps natively between glyphs — a single sentence-wide
// <ruby> resists line breaking and overflows narrow cards. The reading stays
// `lang="ja"` so screen-reader pronunciation is preserved.

export function SentenceBand({
  ja,
  furigana,
  en,
  furiganaMode,
  autoRevealTranslation = false,
  swapToken,
}: SentenceBandProps): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  // Translation blur state. Starts hidden when the pref is off; click-to-
  // reveal flips it. Resets per-mount, so each new card starts blurred.
  const [translationRevealed, setTranslationRevealed] = useState(autoRevealTranslation)
  const renderReading = furiganaMode !== 'off' && furigana !== undefined && furigana !== ''

  // Sentence-swap cue: re-key the band when the pager steps to another example
  // so its entrance replays. Driven by the index (not the text) so live edits
  // in the editor preview don't retrigger it. See useSentenceSwapKey.
  const swapKey = useSentenceSwapKey(swapToken)

  function handleClick() {
    if (furiganaMode === 'hover') setRevealed((r) => !r)
  }

  function handleTranslationClick() {
    if (!translationRevealed) setTranslationRevealed(true)
  }

  return (
    <div
      key={swapKey}
      className={cn(
        'flex w-full min-w-0 flex-col gap-2',
        swapKey > 0 && 'animate-sentence-swap',
      )}
    >
      <div
        onClick={handleClick}
        className={cn(
          'flex min-w-0 flex-col gap-0.5',
          furiganaMode === 'hover' ? 'cursor-pointer group' : '',
        )}
        data-furigana-mode={furiganaMode}
        data-revealed={revealed ? 'true' : 'false'}
      >
        {renderReading && (
          // Reading line stacked above the sentence. In 'hover' mode it fades in
          // on hover (desktop) or on tap (mobile, via `revealed`); it stays in
          // the DOM either way so screen readers still announce the reading.
          <p
            lang="ja"
            className={cn(
              'font-japanese text-sm leading-relaxed text-faded-sumi min-w-0 max-w-full [overflow-wrap:anywhere]',
              'transition-opacity duration-200 ease-out motion-reduce:transition-none',
              furiganaMode === 'always' || revealed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            {furigana}
          </p>
        )}
        {/* The sentence itself: plain CJK text, so it wraps between glyphs. */}
        <p
          lang="ja"
          className="font-japanese text-xl leading-relaxed text-sumi-ink min-w-0 max-w-full [overflow-wrap:anywhere] md:text-2xl"
        >
          {ja}
        </p>
      </div>
      {en !== undefined && en !== '' && (
        <p
          onClick={handleTranslationClick}
          aria-label={translationRevealed ? undefined : 'Reveal translation'}
          role={translationRevealed ? undefined : 'button'}
          tabIndex={translationRevealed ? undefined : 0}
          onKeyDown={(e) => {
            if (!translationRevealed && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              setTranslationRevealed(true)
            }
          }}
          className={cn(
            'text-sm md:text-base text-faded-sumi leading-relaxed',
            'transition-colors duration-300 ease-out select-text',
            translationRevealed
              ? '[filter:blur(0)]'
              : 'cursor-pointer text-faded-sumi/85 hover:text-sumi-ink',
          )}
        >
          {!translationRevealed && <RevealEyeGlyph />}
          <span
            className={cn(
              'transition-[filter] duration-300 ease-out',
              translationRevealed ? '[filter:blur(0)]' : '[filter:blur(6px)]',
            )}
          >
            {en}
          </span>
        </p>
      )}
    </div>
  )
}
