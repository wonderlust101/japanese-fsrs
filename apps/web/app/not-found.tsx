"use client";

import { usePathname } from "next/navigation";

import {
	DevPanel,
	EmptyPathVisual,
	HeroKicker,
	IdentityStrip,
	PageBody,
	PageHeadline,
	PageStateFrame,
	PrimaryAction,
	VisualSlot,
} from "./_components/page-state";

/**
 * Root not-found surface. Catches unmatched routes from anywhere outside
 * the (app) segment (which has its own in-shell variant). Renders full-bleed
 * so it works regardless of auth state or whether the app shell itself is
 * broken — by design, this page never depends on the sidebar or top-bar.
 *
 * Voice: path-as-place metaphor. The kicker (路 · END OF THE PATH) and
 * headline ("This path isn't part of Tomo.") frame the URL as a place that
 * doesn't exist, not as an error. The body line ("Nothing has been lost.")
 * preempts the data-loss anxiety that 404s sometimes trigger for serious
 * learners with months of FSRS state.
 */
export default function NotFound(): React.JSX.Element {
	const pathname = usePathname();

	return (
		<PageStateFrame variant="fullbleed">
			<IdentityStrip />
			<HeroKicker kanji="路" label="End of the path" />
			<VisualSlot>
				<EmptyPathVisual />
			</VisualSlot>
			<PageHeadline>This path isn&apos;t part of Tomo.</PageHeadline>
			<PageBody>Nothing has been lost.</PageBody>
			<PrimaryAction href="/today">Back to home</PrimaryAction>
			<DevPanel pathname={pathname} />
		</PageStateFrame>
	);
}
