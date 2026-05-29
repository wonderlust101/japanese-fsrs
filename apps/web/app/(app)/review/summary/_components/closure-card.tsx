import type { SessionSummary } from "@fsrs-japanese/shared-types";

import type { SummaryContent } from "@/lib/review/summary-pattern";
import { RatingDistributionBar } from "@/components/review/summary/RatingDistributionBar";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { cn } from "@/lib/utils";

function formatTime(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60)
		return `${s}s`;
	return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Closure card ────────────────────────────────────────────────────────────
// Full-width SectionCard. Internal 2-col on lg+: text-left (kicker comes from
// SectionCard's own header, so the card body holds headline + receipt +
// rationale + action), mark-right at responsive 96 / 144px.

export function ClosureHeader({
	content,
	userTotalSessions,
}: {
	content: SummaryContent;
	userTotalSessions: number;
}): React.JSX.Element {
	// First-session copy variant — only when the user has exactly one
	// session in their history. Softer headline, orientation subtitle.
	const isFirstSession = userTotalSessions === 1;
	const kicker = isFirstSession
		? { kanji: "初", label: "First session" }
		: content.kicker;
	const headline = isFirstSession
		? "You're underway."
		: content.heroHeadline;
	const subtitle = isFirstSession
		? "This page closes each session. The diagnosis below adapts to what just happened."
		: content.heroSubcopy;

	return (
		<PageHeader
			kanji={kicker.kanji}
			label={kicker.label}
			title={headline}
			{...(subtitle !== undefined && { subtitle })}
		/>
	);
}

export function ClosureCard({
	content,
	resolved,
	breakdown,
	onPrimary,
	onSecondary,
	sessionsToday,
}: {
	content: SummaryContent;
	resolved: SessionSummary;
	breakdown: { again: number; hard: number; good: number; easy: number };
	onPrimary: () => void;
	onSecondary: () => void;
	sessionsToday: number;
}): React.JSX.Element {
	const cardsWord = resolved.totalCards === 1 ? "card" : "cards";
	const timeLabel = formatTime(resolved.totalTimeMs);

	return (
		<SectionCard
			id="summary-closure"
			kanji="今"
			label={sessionsToday > 1 ? `Today's sessions (${sessionsToday})` : "Today's session"}
			stripeTone="brand"
		>
			<div>
				<div className="min-w-0">
					{/* Rating breakdown leads: the distribution is the richest
                     read on "how did the session go?", so it gets the prime
                     first-glance slot. Suppressed for zero-card sessions; an
                     empty distribution bar would just be visual noise. */}
					{resolved.totalCards > 0 && (
						<div className="flex flex-col gap-3">
							<p className="font-mono text-sm text-faded-sumi">
								Rating breakdown
							</p>
							<RatingDistributionBar
								breakdown={breakdown}
								total={resolved.totalCards}
							/>
						</div>
					)}

					{/* Total + Time stats. Shares the Review Setup summary card's
                     visual language so the practice loop closes on the same
                     type sizes + grid it opened with. */}
					<dl
						className={cn(
							"grid grid-cols-1 sm:grid-cols-2",
							"gap-x-6 gap-y-4",
							"max-w-[28rem]",
							resolved.totalCards > 0 && "mt-7",
						)}
					>
						<ClosureStat
							label="Total"
							value={String(resolved.totalCards)}
							suffix={cardsWord}
						/>
						<ClosureStat
							label="Time"
							value={resolved.totalCards === 0 ? "0s" : timeLabel}
						/>
					</dl>

					<div className="mt-7 flex flex-col gap-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<Button variant="primary" size="lg" onClick={onPrimary}>
								{content.primary.label}
							</Button>
							{content.secondary !== undefined && (
								<Button variant="editorial" size="lg" onClick={onSecondary}>
									{content.secondary.label}
								</Button>
							)}
						</div>
					</div>
				</div>

			</div>
		</SectionCard>
	);
}

function ClosureStat({
	label,
	value,
	suffix,
}: {
	label: string;
	value: string;
	suffix?: string;
}): React.JSX.Element {
	return (
		<div className="flex items-baseline gap-2 min-w-0 sm:justify-self-start">
			<dt className="font-mono text-sm text-faded-sumi">
				{label}
			</dt>
			<dd className="flex items-baseline gap-2 min-w-0">
				<span className="font-display text-stat tabular-nums text-sumi-ink">
					{value}
				</span>
				{suffix !== undefined && (
					<span className="font-display text-sm text-faded-sumi">
						{suffix}
					</span>
				)}
			</dd>
		</div>
	);
}
