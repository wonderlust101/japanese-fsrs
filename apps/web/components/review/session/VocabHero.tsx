'use client'

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
        className={cn('font-japanese font-medium leading-[1.05] text-sumi-ink')}
        style={{ fontSize }}
      >
        {word}
      </span>
    )
  }

  return (
    <ruby
      lang="ja"
      className={cn('font-japanese font-medium leading-[1.05] text-sumi-ink')}
      style={{ fontSize }}
    >
      {word}
      <rt className="font-mono text-[0.3em] tracking-[0.05em] text-faded-sumi font-normal not-italic">
        {reading}
      </rt>
    </ruby>
  )
}
