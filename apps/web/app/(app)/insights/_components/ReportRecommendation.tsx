import Link from 'next/link'

import { cn } from '@/lib/utils'

import { splitEmphasis, type RecommendationTone } from './weekly-report'

interface ReportRecommendationProps {
  tone:     RecommendationTone
  kanji:    string
  headline: string
  body?:    string
  action:   { label: string; href: string }
}

const KANJI_TONE: Record<RecommendationTone, string> = {
  attention:   'text-inari-vermillion-deep',
  pacing:      'text-sumi-ink',
  celebratory: 'text-inari-vermillion',
}

/**
 * The single pinned "do this next" callout near the top of the report.
 * Always present; reframes by mood (attention / pacing / celebratory).
 * Sits on a Cream Inset surface — distinct from the page background but
 * NOT a card (no top stripe, no shadow). The kanji ornament is the loud
 * element; the rest of the layout stays calm.
 */
export function ReportRecommendation({
  tone,
  kanji,
  headline,
  body,
  action,
}: ReportRecommendationProps): React.JSX.Element {
  return (
    <aside
      aria-label="Your next move"
      className={cn(
        'relative grid grid-cols-[auto,1fr] items-start gap-x-5 gap-y-4 rounded-[2px]',
        'bg-cream-inset',
        'px-5 py-5 sm:px-6 sm:py-6',
      )}
    >
      <span
        lang="ja"
        aria-hidden="true"
        className={cn(
          'select-none font-display leading-none',
          'text-[2.75rem] sm:text-[3.25rem]',
          KANJI_TONE[tone],
        )}
      >
        {kanji}
      </span>

      <div className="min-w-0">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
          Your next move
        </p>
        <p className="mt-1.5 max-w-[44ch] font-display text-[1.1875rem] leading-[1.3] text-sumi-ink sm:text-[1.3125rem]">
          {renderEmphasis(headline, tone)}
        </p>
        {body !== undefined && (
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-faded-sumi">
            {body}
          </p>
        )}
        <div className="mt-4">
          <Link
            href={action.href}
            className={cn(
              'inline-flex h-10 items-center rounded-[2px] px-4 text-sm font-medium',
              'bg-inari-vermillion text-warm-paper-raised',
              'transition-colors duration-150 ease-out',
              'hover:bg-inari-vermillion-deep',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
            )}
          >
            {action.label}
          </Link>
        </div>
      </div>
    </aside>
  )
}

function renderEmphasis(text: string, tone: RecommendationTone): React.ReactNode {
  const parts = splitEmphasis(text)
  const emphasisClass =
    tone === 'attention'
      ? 'font-semibold text-inari-vermillion-deep'
      : tone === 'celebratory'
        ? 'font-semibold text-inari-vermillion'
        : 'font-semibold text-sumi-ink'
  return parts.map((p, i) =>
    p.kind === 'em' ? (
      <em key={i} className={cn('not-italic', emphasisClass)}>
        {p.text}
      </em>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )
}
