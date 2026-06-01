"use client";

import { Card } from "@/components/ui/Card";

/**
 * StepChild is the onboarding-era wrapper used by the five step pages
 * (decks, goal, interests, level, schedule) for per-row layout. It used to
 * orchestrate the staggered fade-up cascade via the `motion` library; with
 * motion removed, it renders a plain `<div>` so call sites don't need to
 * change.
 */
export function StepChild({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}): React.JSX.Element {
	return <div className={className}>{children}</div>;
}

interface StepCardProps {
	/** Left pane: the SRS preview visualization. */
	previewPane: React.ReactNode;
	heading: string;
	subhead: string;
	/** Right pane content: answer affordance (selection cards, chips, deck rows). */
	children: React.ReactNode;
	/** Footer row content: Back + Continue buttons. */
	footer: React.ReactNode;
}

/**
 * The shared composition for the five questionnaire steps.
 *
 * Choreography: the entire grid (preview pane + right column) is wrapped in a
 * single staggering motion container. delayChildren on that outer container is
 * tuned to wait for CardStack's foreground fade-in, so the card mounts
 * visibly empty before any content appears. Then content cascades:
 *
 *   1. Aside (preview pane) fades in
 *   2. Right column begins, header first
 *   3. Body items stagger in tightly
 *   4. Footer arrives near the end
 *
 * On `< lg`, the columns stack with the aside above the question column;
 * the stagger order is preserved. The split is deferred to `lg` (not `md`)
 * because the two-column grid only has room to breathe past ~1024px — at
 * tablet-portrait width the 38% preview pane and answer column both cramp
 * (headings over-wrap, inline option text truncates), so tablets get the
 * full-width single-column stack instead.
 */
export function StepCard({
	previewPane,
	heading,
	subhead,
	children,
	footer,
}: StepCardProps): React.JSX.Element {
	return (
		<Card variant="default">
			<div className="grid grid-cols-1 lg:grid-cols-[38%_1fr] gap-8 lg:gap-12">
				{/* SRS preview pane: arrives first in the cascade so the visualization
            is already settling when the question column begins to appear. */}
				<aside
					className="flex flex-col items-stretch gap-3 animate-card-reveal"
					style={{ animationDelay: "150ms" }}
				>
					<div className="flex items-center gap-3 text-xs font-mono tracking-wide text-faded-sumi">
						<span>Preview</span>
						<span aria-hidden="true" className="h-px flex-1 bg-soft-hairline" />
					</div>
					<div className="flex-1">{previewPane}</div>
				</aside>

				{/* Right column: heading → body → footer cascade */}
				<section className="flex flex-col gap-8">
					<header
						className="flex flex-col gap-2 animate-card-reveal"
						style={{ animationDelay: "240ms" }}
					>
						<h1 className="font-display text-2xl md:text-3xl font-semibold text-sumi-ink leading-[1.1]">
							{heading}
						</h1>
						<p className="text-base text-faded-sumi leading-relaxed max-w-measure">
							{subhead}
						</p>
					</header>

					<div
						className="animate-card-reveal"
						style={{ animationDelay: "330ms" }}
					>
						{children}
					</div>

					<div
						className="mt-auto pt-2 animate-card-reveal"
						style={{ animationDelay: "430ms" }}
					>
						{footer}
					</div>
				</section>
			</div>
		</Card>
	);
}
