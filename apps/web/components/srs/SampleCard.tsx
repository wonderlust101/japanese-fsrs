'use client'

import { FuriganaText } from '@/components/ui/FuriganaText'

interface SampleCardProps {
  /** The Japanese word the sample card displays. */
  word:     string
  /** Reading (hiragana/katakana). */
  reading:  string
  /** English meaning. */
  meaning:  string
  /** Small mono caption, e.g. "matched: 12 decks" or "next review in 4h". */
  caption?: string
  /** Identifier driving the cross-fade animation when content changes. */
  changeKey?: string
  className?: string
}

/**
 * A small, real-looking SRS card preview. Used in the Goal step's preview
 * pane (showing what kind of card the user would see) and on the Decks
 * step (showing a representative card from the subscribed decks).
 *
 * Visually carries the same anatomy as the host Card primitive (top-stripe,
 * sharp corners, hairline) but at smaller scale.
 */
export function SampleCard({
  word,
  reading,
  meaning,
  caption,
  changeKey = `${word}-${reading}-${meaning}`,
  className = '',
}: SampleCardProps): React.JSX.Element {
  const _reducedMotion = false

  return (
    <div
      className={[
        'relative rounded-xs bg-warm-paper-raised border border-soft-hairline',
        'px-5 pt-6 pb-4 w-full',
        className,
      ].join(' ')}
    >
      {/* Top stripe */}
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[2px] bg-inari-vermillion"
      />

      <>
        <div
          key={changeKey}        >
          <FuriganaText
            text={word}
            reading={reading}
            className="font-japanese text-2xl font-medium text-sumi-ink leading-tight"
          />
          <p className="mt-2 text-sm text-faded-sumi">{meaning}</p>
          {caption !== undefined && (
            <p className="mt-3 pt-3 border-t border-soft-hairline text-xs text-faded-sumi font-mono">
              {caption}
            </p>
          )}
        </div>
      </>
    </div>
  )
}
