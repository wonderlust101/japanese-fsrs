import type { RecommendationTone } from "./weekly-report";
import { ButtonLink } from "@/components/ui/Button";

import { cn } from "@/lib/utils";
import { splitEmphasis } from "./weekly-report";

interface ReportRecommendationProps {
	tone: RecommendationTone;
	kanji: string;
	headline: string;
	body?: string;
	/**
	 * Optional CTA. When omitted, the callout renders as a quiet statement
	 *  with no button (used for forward-looking states with nothing to start).
	 */
	action?: { label: string; href: string };
}

const KANJI_TONE: Record<RecommendationTone, string> = {
	attention: "text-inari-vermillion-deep",
	pacing: "text-sumi-ink",
	celebratory: "text-inari-vermillion",
};

/**
 * The single pinned "do this next" callout near the top of the report.
 * Always present; reframes by mood (attention / pacing / celebratory).
 * Sits on a Cream Inset surface — distinct from the page background but
 * NOT a card (no top stripe, no shadow). The kanji ornament is the loud
 * element; the rest of the layout stays calm.
 */
export function ReportRecommendation({
	tone,
	kanji,
	headline,
	body,
	action,
}: ReportRecommendationProps): React.JSX.Element {
	return (
		<aside
			aria-label="Your next move"
			className={cn(
				"relative grid grid-cols-[auto,1fr] items-start gap-x-6 gap-y-4 rounded-xs",
				"bg-cream-inset",
				"px-5 py-5 sm:px-6 sm:py-6",
			)}
		>
			<span
				lang="ja"
				aria-hidden="true"
				className={cn(
					"select-none font-display leading-none",
					"text-[2.75rem] sm:text-[3.25rem]",
					KANJI_TONE[tone],
				)}
			>
				{kanji}
			</span>

			<div className="min-w-0">
				<p className="font-mono text-sm text-faded-sumi">
					Your next move
				</p>
				<p className="mt-1.5 max-w-measure-tight font-display text-lg leading-[1.3] text-sumi-ink sm:text-lg">
					{renderEmphasis(headline, tone)}
				</p>
				{body !== undefined && (
					<p className="mt-2 max-w-measure text-base leading-relaxed text-faded-sumi">
						{body}
					</p>
				)}
				{action !== undefined && (
					<div className="mt-4">
						<ButtonLink href={action.href} variant="primary" size="md">
							{action.label}
						</ButtonLink>
					</div>
				)}
			</div>
		</aside>
	);
}

function renderEmphasis(text: string, tone: RecommendationTone): React.ReactNode {
	const parts = splitEmphasis(text);
	const emphasisClass
		= tone === "attention"
			? "font-semibold text-inari-vermillion-deep"
			: tone === "celebratory"
				? "font-semibold text-inari-vermillion"
				: "font-semibold text-sumi-ink";
	// Visual color/weight emphasis only, not stress emphasis: render as <span>.
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
