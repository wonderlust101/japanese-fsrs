import { Logo } from '@/components/ui/Logo'
import { QuietLink } from '@/components/ui/QuietLink'

/**
 * Empty / new-user state for the Insights Overview. The kitsune sits at
 * one of its allowed emotional moments — present when the report can't
 * yet appear, quiet rather than narrating. One short line of teacher-voice
 * prose; one quiet link to the place that fixes the absence (a first
 * review). Nothing else.
 */
export function EmptyInsights(): React.JSX.Element {
  return (
    <section
      aria-label="Insights need a few more sessions"
      className="mx-auto flex flex-col items-center gap-y-7 py-6 text-center"
    >
      <Logo size={112} showWordmark={false} priority />

      <p className="max-w-[36ch] font-display text-[1.25rem] leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
        Your report needs a few sessions to find its shape.
      </p>

      <p className="max-w-[44ch] text-sm leading-relaxed text-faded-sumi">
        After three or four more reviews, the page will fill in with what
        you&rsquo;re working on, where you&rsquo;re slipping, and what the
        week ahead looks like.
      </p>

      <div className="pt-2">
        <QuietLink href="/today" tone="brand" trailingArrow size="md">
          Start a review
        </QuietLink>
      </div>
    </section>
  )
}
