import { Logo } from '@/components/ui/Logo'
import { QuietLink } from '@/components/ui/QuietLink'

interface MistakesEmptyProps {
  variant: 'clean' | 'not-enough'
  /** Render the dev-flavored copy variant when previewing without data. */
  isDev?:  boolean
}

/**
 * Empty state for the Mistakes page. Two variants:
 *
 *   - clean: nothing flagged. Celebrate quietly.
 *   - not-enough: under the review-count threshold. Set expectations.
 *
 * Deliberately no skeleton charts. IA: "Say so clearly and avoid
 * inventing work" (No Major Mistakes state); "Explain that mistake
 * patterns need more reviews" (Limited Data state).
 */
export function MistakesEmpty({ variant, isDev = false }: MistakesEmptyProps): React.JSX.Element {
  const headline = variant === 'clean'
    ? 'Your collection is holding clean.'
    : 'Mistake patterns need a few weeks of reviews.'

  const body = isDev
    ? variant === 'clean'
      ? 'Clean-state fixture selected. The page renders the kitsune and a quiet link when nothing is flagged.'
      : 'Not-enough-data fixture selected. Below the threshold of recent reviews, sections are hidden until there\'s enough signal to read.'
    : variant === 'clean'
      ? 'Nothing flagged inside this window. Keep reviewing, and any new trouble will surface here.'
      : 'After a couple more weeks, the page will surface repeated mistake patterns, leeches, confusable pairs, and cards with missing support.'

  const linkLabel = variant === 'clean' ? 'Open your cards' : 'Start a review'
  const linkHref  = variant === 'clean' ? '/cards' : '/today'

  return (
    <section
      aria-label={variant === 'clean' ? 'No major mistakes' : 'Not enough review data'}
      className="mx-auto mt-12 flex flex-col items-center gap-y-7 py-6 text-center lg:mt-20"
    >
      <Logo size={112} showWordmark={false} priority />

      <p className="max-w-[36ch] font-display text-[1.25rem] leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
        {headline}
      </p>

      <p className="max-w-[48ch] text-sm leading-relaxed text-faded-sumi">
        {body}
      </p>

      <div className="pt-2">
        <QuietLink href={linkHref} tone="brand" trailingArrow size="md">
          {linkLabel}
        </QuietLink>
      </div>
    </section>
  )
}
