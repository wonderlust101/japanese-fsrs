import type { NoteTone } from "./weekly-report";

import { QuietLink } from "@/components/ui/QuietLink";
import { SectionCard } from "@/components/ui/SectionCard";

import { cn } from "@/lib/utils";
import { splitEmphasis } from "./weekly-report";

export type NoteWeight = "lead" | "medium" | "compact";

interface RankedNoteProps {
	weight: NoteWeight;
	tone: NoteTone;
	kanji: string;
	label: string;
	body: string;
	deepLink: { label: string; href: string };
	/** Optional inline sketch (lives below the body inside the same card). */
	children?: React.ReactNode;
}

/**
 * One beat of the weekly report, rendered as a `SectionCard` (the brand's
 * canonical 2px-top-stripe + soft-hairline card surface). Three weights
 * vary interior content density:
 *
 *  - `lead`    : larger body type; on lg+ the prose and sketch split into a
 *                two-column interior so the card uses 1440px without
 *                creating unreadable line lengths.
 *  - `medium`  : standard body type, stacked interior. Sized for the
 *                2-col notes grid where each card is roughly half the page.
 *  - `compact` : smaller body type, compact header variant.
 *
 * The weight is fixed by note kind, not by severity: progress always leads,
 * mistakes takes the medium slot, planning the compact slot — so the sections
 * never swap positions between loads. All weights render their assigned sketch
 * when one is available; the sketch is part of the card body, not a standalone
 * element.
 */
export function RankedNote({
	weight,
	tone,
	kanji,
	label,
	body,
	deepLink,
	children,
}: RankedNoteProps): React.JSX.Element {
	const isLead = weight === "lead";
	const isCompact = weight === "compact";
	const hasSketch = children !== undefined && children !== null;

	const bodyTypeClass = isLead
		? "text-md leading-relaxed sm:text-lg lg:text-lg"
		: isCompact
			? "text-base leading-relaxed"
			: "text-md leading-relaxed";

	return (
		<SectionCard
			kanji={kanji}
			label={label}
			variant={isCompact ? "compact" : "default"}
			rightContent={(
				<QuietLink
					href={deepLink.href}
					tone="sumi"
					trailingArrow
					size="sm"
				>
					{deepLink.label}
				</QuietLink>
			)}
		>
			{isLead && hasSketch
				? (
						<div className="grid grid-cols-1 gap-y-8 @4xl/insights:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] @4xl/insights:items-center @4xl/insights:gap-x-16">
							<p className={cn("max-w-measure text-sumi-ink/90", bodyTypeClass)}>
								{renderEmphasis(body, tone)}
							</p>
							<div className="min-w-0 pb-1 lg:py-2 xl:py-3">
								{children}
							</div>
						</div>
					)
				: (
						<>
							<p className={cn("max-w-measure text-sumi-ink/90", bodyTypeClass)}>
								{renderEmphasis(body, tone)}
							</p>
							{hasSketch && (
								<div className={cn("mt-7 pb-1", isCompact && "mt-6")}>
									{children}
								</div>
							)}
						</>
					)}
		</SectionCard>
	);
}

function renderEmphasis(text: string, tone: NoteTone): React.ReactNode {
	const parts = splitEmphasis(text);
	// Red emphasis uses the same vermillion-deep as the charts' data ink, so the
	// numbers in prose and figures read as one palette. Neutral notes stay sumi.
	const emphasisClass
		= tone === "neutral"
			? "font-semibold text-sumi-ink"
			: "font-semibold text-inari-vermillion-deep";
	// Emphasis is visual color/weight only (a number or key word in the prose),
	// not stress emphasis, so it renders as <span> rather than <em>.
	return parts.map((p, i) =>
		p.kind === "em"
			? (
					// eslint-disable-next-line react/no-array-index-key -- positional prose segment (text may repeat); index is the stable identity.
					<span key={i} className={emphasisClass}>
						{p.text}
					</span>
				)
			: (
					// eslint-disable-next-line react/no-array-index-key -- positional prose segment (text may repeat); index is the stable identity.
					<span key={i}>{p.text}</span>
				),
	);
}
