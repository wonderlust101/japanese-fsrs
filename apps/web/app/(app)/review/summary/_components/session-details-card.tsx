import type { SummaryContent } from "@/lib/review/summary-pattern";
import { TeacherQuotation } from "@/components/review/TeacherQuotation";
import { SectionCard } from "@/components/ui/SectionCard";

// ── Session details card ────────────────────────────────────────────────────
// Two sub-sections inside one SectionCard, separated by a hairline. Top:
// "What to notice" diagnosis prose. Bottom: "Rating breakdown" with the
// existing distribution bar. The card's outer kanji header (詳 / Session
// details) labels the whole moment.

export function SessionDetailsCard({
	content,
	reflectionBody,
	reflectionLoading,
}: {
	content: SummaryContent;
	/**
	 * AI-generated post-session reflection body. When present, replaces the
	 *  deterministic `content.diagnosisLead` inside the bracketed quote.
	 *  When undefined and `reflectionLoading` is false, the rule-based lead
	 *  is used as a silent fallback.
	 */
	reflectionBody?: string | undefined;
	reflectionLoading?: boolean;
}): React.JSX.Element {
	// Prefer AI reflection when loaded. While loading on first fetch, show
	// a quiet skeleton — the deterministic lead is fallback, not a teaser,
	// so the user doesn't see prose A change to prose B mid-read.
	const showSkeleton = reflectionLoading === true && reflectionBody === undefined;
	const leadText = reflectionBody !== undefined && reflectionBody.length > 0
		? reflectionBody
		: content.diagnosisLead;
	return (
		<SectionCard
			id="summary-details"
			kanji="詳"
			label="Session details"
			description="A closer read on how this session went."
			className="flex h-full flex-col"
		>
			<div className="flex flex-1 flex-col justify-center mb-5">
				{showSkeleton ? (
					<ReflectionSkeleton />
				) : (
				// Keyed wrapper triggers React's mount cycle when the lead
				// text changes (skeleton → resolved AI body → fallback). The
				// `animate-card-reveal` keyframe defined in globals.css is a
				// 250ms cubic-bezier opacity+translate fade — the project's
				// canonical reveal motion. Reduced-motion users get an instant
				// cut via the standard `motion-reduce:animate-none` guard.
					<div
						key={leadText}
						className="animate-card-reveal motion-reduce:animate-none"
					>
						<TeacherQuotation lead={leadText} />
					</div>
				)}
			</div>
		</SectionCard>
	);
}

// Soft skeleton placeholder shown only on the AI reflection's first load.
// Mirrors the bracket-and-prose silhouette of TeacherQuotation so the swap
// doesn't shift surrounding layout when the real text arrives. The faded
// background pulse is purely visual; the layout height is set by the same
// `min-h-[200px]` floor TeacherQuotation uses.
function ReflectionSkeleton(): React.JSX.Element {
	return (
		<div className="relative flex h-full min-h-[200px] flex-col justify-center py-6" aria-busy="true" aria-live="polite">
			<div className="mx-auto flex w-full max-w-measure-tight flex-col gap-3 px-4">
				<div className="h-4 w-5/6 animate-pulse rounded-xs bg-cream-inset/80 motion-reduce:animate-none" />
				<div className="h-4 w-4/6 animate-pulse rounded-xs bg-cream-inset/80 motion-reduce:animate-none" />
				<div className="h-4 w-3/6 animate-pulse rounded-xs bg-cream-inset/80 motion-reduce:animate-none" />
			</div>
		</div>
	);
}
