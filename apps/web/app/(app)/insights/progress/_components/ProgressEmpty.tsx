import { Logo } from '@/components/ui/Logo'
import { QuietLink } from '@/components/ui/QuietLink'

import { LIMITED_THRESHOLD_DAYS, limitedReturnDate } from './progressInterpretation'

interface ProgressEmptyProps {
  /** ISO date of the user's first review, or null if no reviews yet. */
  firstReviewDate: string | null
  /** Render the dev-flavored copy variant when we're previewing without data. */
  isDev?:          boolean
}

/**
 * Limited-data state for the Progress page. The IA brief explicitly names
 * this as one of the four real states; we honor it with the same kitsune
 * mark used elsewhere in Insights, a one-line plain-language read, and a
 * concrete return date computed from the user's first review date.
 *
 * Deliberately no skeleton charts. The IA says "Set expectations about
 * what can be shown" — a blank page with a date is more honest than a
 * grey scaffold pretending to load.
 */
export function ProgressEmpty({
  firstReviewDate,
  isDev = false,
}: ProgressEmptyProps): React.JSX.Element {
  const returnDate = firstReviewDate !== null
    ? limitedReturnDate(firstReviewDate)
    : null

  return (
    <section
      aria-label="Progress takes a beat to settle"
      className="mx-auto mt-12 flex flex-col items-center gap-y-7 py-6 text-center lg:mt-20"
    >
      <Logo size={112} showWordmark={false} priority />

      <p className="max-w-[36ch] font-display text-[1.25rem] leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
        Progress takes a beat to settle.
      </p>

      <p className="max-w-[48ch] text-sm leading-relaxed text-faded-sumi">
        {isDev
          ? 'Limited-data fixture selected. After about two weeks of reviews, the page will fill with retention, mature growth, JLPT coverage, and cadence.'
          : returnDate !== null
            ? `Come back around ${returnDate}, when you'll have enough history to see the shape.`
            : `After about ${LIMITED_THRESHOLD_DAYS} days of reviews, this page will show retention, mature growth, JLPT coverage, and cadence.`}
      </p>

      <div className="pt-2">
        <QuietLink href="/today" tone="brand" trailingArrow size="md">
          Start a review
        </QuietLink>
      </div>
    </section>
  )
}
