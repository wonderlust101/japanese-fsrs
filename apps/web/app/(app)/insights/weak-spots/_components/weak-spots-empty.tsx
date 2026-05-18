import { Logo } from '@/components/ui/Logo'
import { QuietLink } from '@/components/ui/QuietLink'

interface WeakSpotsEmptyProps {
  variant: 'unresolved' | 'resolved'
}

/**
 * Empty state for the weakSpots page. Two variants matching the doc's
 * empty-state copy contract:
 *
 *   - unresolved: nothing to triage right now. Calm reassurance.
 *   - resolved:   no resolved-weakSpot history yet. Inert mode.
 *
 * Mirrors `MistakesEmpty` visual register so the two surfaces feel like
 * the same product family.
 */
export function WeakSpotsEmpty({ variant }: WeakSpotsEmptyProps): React.JSX.Element {
  const headline = variant === 'unresolved'
    ? 'No weak spots right now.'
    : 'No resolved weak spots yet.'

  const body = variant === 'unresolved'
    ? 'Keep your daily reviews steady; this list fills only when a card needs extra attention.'
    : 'Cards you resolve will show up here, so you can see the pattern of what got better over time.'

  const linkLabel = variant === 'unresolved' ? 'Start a review' : 'Open your cards'
  const linkHref  = variant === 'unresolved' ? '/today' : '/cards'

  return (
    <section
      aria-label={variant === 'unresolved' ? 'No unresolved weak spots' : 'No resolved weak spots'}
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
