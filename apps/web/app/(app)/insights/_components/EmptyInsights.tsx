import { KitsuneEmptyState } from '@/components/ui/KitsuneEmptyState'

/**
 * Empty / new-user state for the Insights Overview. The kitsune sits at
 * one of its allowed emotional moments — present when the report can't
 * yet appear, quiet rather than narrating. One short line of teacher-voice
 * prose; one quiet link to the place that fixes the absence (a first
 * review). Nothing else.
 */
export function EmptyInsights(): React.JSX.Element {
  return (
    <KitsuneEmptyState
      ariaLabel="Insights need a few more sessions"
      headline="Your report needs a few sessions to find its shape."
      body="After three or four more reviews, the page will fill in with what you’re working on, where you’re slipping, and what the week ahead looks like."
      ctaHref="/today"
      ctaLabel="Start a review"
    />
  )
}
