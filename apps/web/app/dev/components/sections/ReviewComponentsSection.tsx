"use client";

import Link from "next/link";
import { RatingBreakdown } from "@/components/review/RatingBreakdown";
import { ShowcaseGrid, ShowcaseItem } from "../_components/ShowcaseItem";
import { ShowcaseSection } from "../_components/ShowcaseSection";

export function ReviewComponentsSection(): React.JSX.Element {
	return (
		<ShowcaseSection
			id="review"
			title="Review components"
			description="Composed views from the review flow. RatingBreakdown stands alone; ReviewCard depends on the live session store and is documented as a placeholder. The production rating row lives in RatingBar — preview it in context at /review/session."
		>
			<div>
				<h3 className="text-xs text-faded-sumi mb-3">RatingBreakdown</h3>
				<ShowcaseGrid minColumnWidth={320}>
					<ShowcaseItem
						label="Typical session"
						caption="breakdown={{again:3,hard:5,good:18,easy:4}} total={30}"
						fill
					>
						<RatingBreakdown breakdown={{ again: 3, hard: 5, good: 18, easy: 4 }} total={30} />
					</ShowcaseItem>
					<ShowcaseItem label="Empty" caption="total={0}" fill>
						<RatingBreakdown breakdown={{ again: 0, hard: 0, good: 0, easy: 0 }} total={0} />
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>

			<div>
				<h3 className="text-xs text-faded-sumi mb-3">ReviewCard</h3>
				<ShowcaseGrid minColumnWidth={520}>
					<ShowcaseItem label="ReviewCard" caption="depends on useReviewSessionStore" fill>
						<div className="flex flex-col gap-3 p-6 bg-cream-inset border border-soft-hairline rounded-xs text-sm text-faded-sumi">
							<p>
								<code className="font-mono text-sumi-ink">ReviewCard</code>
								{" "}
								reads its current
								card from
								<code className="font-mono text-sumi-ink">useReviewSessionStore</code>
								{" "}
								and renders
								{" "}
								<code>null</code>
								{" "}
								when the store is empty. Hydrating it here would
								require a representative
								{" "}
								<code className="font-mono">ApiDueCard</code>
								{" "}
								payload
								that drifts with the store shape.
							</p>
							<p>
								To preview it in context, start a real review:
								{" "}
								<Link href="/review/setup" className="text-inari-vermillion hover:text-inari-vermillion-deep underline underline-offset-2">
									/review/setup
								</Link>
								.
							</p>
						</div>
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>
		</ShowcaseSection>
	);
}
