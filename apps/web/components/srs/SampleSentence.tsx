'use client'

import { FuriganaText } from '@/components/ui/FuriganaText'

interface RubyChunk {
  base:    string
  reading: string
}

type SentenceChunk = RubyChunk | string

interface SampleSentenceProps {
  /** The Japanese sentence as an array of plain-text spans and ruby chunks. */
  chunks:      ReadonlyArray<SentenceChunk>
  translation: string
  /** Caption identifying which interest produced this sentence. */
  caption?:    string
  /** Identifier driving cross-fade. */
  changeKey?:  string
  className?:  string
}

/**
 * A live-updating example sentence preview. Shown on the Interests step's
 * preview pane, drawn from the user's currently-selected interest topics.
 * Renders Japanese with proper ruby/rt furigana so screen readers handle
 * pronunciation correctly.
 */
export function SampleSentence({
  chunks,
  translation,
  caption,
  changeKey,
  className = '',
}: SampleSentenceProps): React.JSX.Element {
  const _reducedMotion = false

  const key = changeKey ?? chunks.map((c) => typeof c === 'string' ? c : c.base).join('')

  return (
    <div
      className={[
        'relative rounded-[2px] bg-warm-paper-raised border border-soft-hairline',
        'px-5 pt-6 pb-4 w-full',
        className,
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[2px] bg-inari-vermillion"
      />

      <>
        <div
          key={key}        >
          <p lang="ja" className="font-japanese text-base text-sumi-ink leading-relaxed">
            {chunks.map((chunk, i) => {
              if (typeof chunk === 'string') return <span key={i}>{chunk}</span>
              return <FuriganaText key={i} text={chunk.base} reading={chunk.reading} rtSize="0.45em" />
            })}
          </p>
          <p className="mt-2 text-sm text-faded-sumi italic">{translation}</p>
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
