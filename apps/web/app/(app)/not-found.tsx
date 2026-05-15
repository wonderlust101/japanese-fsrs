'use client'

import { usePathname } from 'next/navigation'

import {
  DevPanel,
  EmptyPathVisual,
  HeroKicker,
  PageBody,
  PageHeadline,
  PageStateFrame,
  PrimaryAction,
  VisualSlot,
} from '../_components/page-state'

/**
 * In-shell not-found surface. Triggers when a route inside the (app)
 * segment calls `notFound()` or doesn't match — typically an old or
 * deleted deck URL, a card ID that no longer exists, or a stale link.
 * The sidebar and top-bar remain visible, so this surface can be lighter
 * than the root variant: no IdentityStrip (the sidebar already carries
 * the brand mark) and no InlinePathsRow (the sidebar already exposes
 * Browse decks, Reviews, and Settings). One primary action, one card.
 *
 * Voice matches the root: this path isn't part of Tomo, nothing has been
 * lost. The reassurance is the same because the underlying anxiety
 * ("did I just lose a deck?") is the same.
 */
export default function AppNotFound(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <PageStateFrame variant="inshell">
      <HeroKicker kanji="路" label="End of the path" />
      <VisualSlot>
        <EmptyPathVisual />
      </VisualSlot>
      <PageHeadline>This path isn&apos;t part of Tomo.</PageHeadline>
      <PageBody>Nothing has been lost.</PageBody>
      <PrimaryAction href="/today">Back to home</PrimaryAction>
      <DevPanel pathname={pathname} />
    </PageStateFrame>
  )
}
