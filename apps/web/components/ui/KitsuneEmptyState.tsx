import type { ReactNode } from 'react'

import { Logo } from '@/components/ui/Logo'
import { QuietLink } from '@/components/ui/QuietLink'

interface KitsuneEmptyStateProps {
  /** Accessible name for the empty-state region. */
  ariaLabel: string
  /** Display-font headline line: the kitsune's one quiet statement. */
  headline:  string
  /** Body prose; a string, or rich nodes when copy branches (e.g. a dev hint). */
  body:      ReactNode
  ctaHref:   string
  ctaLabel:  string
}

/**
 * The full-page "kitsune at a quiet moment" empty state: a centered kitsune
 * mark, a display-font headline, a faded prose line, and one quiet CTA. This
 * is the larger, borderless brand beat that the page-level surfaces reach for
 * when a whole report or list can't yet appear.
 *
 * Deliberately distinct from {@link EmptyState}, the compact bordered
 * kanji-card used for zero-data / no-match / inline-error *inside* a content
 * area. Two archetypes, one per scale; do not collapse them.
 *
 * Extracted from the structurally-identical empty states the Insights pages
 * (and weak-spots) had each hand-rolled, so only the copy varies per surface.
 */
export function KitsuneEmptyState({
  ariaLabel,
  headline,
  body,
  ctaHref,
  ctaLabel,
}: KitsuneEmptyStateProps): React.JSX.Element {
  return (
    <section
      aria-label={ariaLabel}
      className="mx-auto mt-12 flex flex-col items-center gap-y-6 py-6 text-center lg:mt-20"
    >
      <Logo size={112} showWordmark={false} priority />

      <p className="max-w-measure-tight font-display text-lg leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
        {headline}
      </p>

      <p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
        {body}
      </p>

      <div className="pt-2">
        <QuietLink href={ctaHref} tone="brand" trailingArrow size="md">
          {ctaLabel}
        </QuietLink>
      </div>
    </section>
  )
}
