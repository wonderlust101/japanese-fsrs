'use client'

import { FuriganaText } from '@/components/ui/FuriganaText'
import { cn } from '@/lib/utils'

interface VocabHeroProps {
  word:       string
  reading?:   string | null
  /** When true, hide the furigana ruby (used by the production card front). */
  hideRuby?:  boolean
  /** Smaller size for the production card back where English is the lead. */
  size?:      'hero' | 'compact'
}

// The kanji-hero. The single largest object on the screen. Renders a
// furigana ruby with Noto Sans JP at display scale. Inherits color from the
// parent so consumers can apply pitch-category coloring.

export function VocabHero({
  word,
  reading,
  hideRuby = false,
  size = 'hero',
}: VocabHeroProps): React.JSX.Element {
  const fontSize =
    size === 'hero'
      ? 'clamp(2.75rem, 7vw, 5rem)'
      : 'clamp(2rem, 4vw, 3rem)'

  if (hideRuby || reading === null || reading === undefined || reading === '' || reading === word) {
    return (
      <span
        lang="ja"
        // max-w-full + overflow-wrap so a long headword wraps within the card
        // on narrow viewports instead of overflowing into the card's
        // overflow-hidden clip. Japanese has no spaces, so wrap anywhere.
        className={cn('font-japanese font-medium leading-[1.05] text-sumi-ink', 'max-w-full [overflow-wrap:anywhere]')}
        style={{ fontSize }}
      >
        {word}
      </span>
    )
  }

  return (
    <FuriganaText
      text={word}
      reading={reading}
      rtSize="0.3em"
      className="font-japanese font-medium leading-[1.05] text-sumi-ink"
      style={{ fontSize }}
    />
  )
}
