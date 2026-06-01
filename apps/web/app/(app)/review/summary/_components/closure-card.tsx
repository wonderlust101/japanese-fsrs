"use client";

import type { SessionSummary } from "@fsrs-japanese/shared-types";

import type { SummaryContent } from "@/lib/review/summary-pattern";
import { useRef } from "react";
import { RatingDistributionBar } from "@/components/review/summary/RatingDistributionBar";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { DUR, EASE } from "@/lib/motion/easings";
import { gsap, useGSAP } from "@/lib/motion/register";
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
	provisional,
}: {
	content: SummaryContent;
	userTotalSessions: number;
	/**
	 * True while the page is rendering local-first numbers and awaiting the
	 *  server summary. The hero is pattern-derived (and the pattern depends on
	 *  weak-spot count, which is server-only), so show a calm neutral header
	 *  until the real summary lands rather than risk a headline flip.
	 */
	provisional?: boolean;
}): React.JSX.Element {
	if (provisional === true) {
		return <PageHeader kanji="済" label="Session wrapped" title="Session wrapped." />;
	}
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
	actionsReady = true,
}: {
	content: SummaryContent;
	resolved: SessionSummary;
	breakdown: { again: number; hard: number; good: number; easy: number };
	onPrimary: () => void;
	onSecondary: () => void;
	sessionsToday: number;
	/**
	 * False while rendering local-first numbers and awaiting the server summary.
	 *  The action labels are pattern-derived, so they're held back until the
	 *  real summary resolves; the breakdown + stats above render immediately.
	 */
	actionsReady?: boolean;
}): React.JSX.Element {
	const cardRef = useRef<HTMLDivElement | null>(null);
	const cardsWord = resolved.totalCards === 1 ? "card" : "cards";
	const timeLabel = formatTime(resolved.totalTimeMs);

	// §2.8 closure-card settle: the card scales and rises from a resting
	// position on mount, then stats cascade in behind it. `opacity` (not
	// `autoAlpha`) on all nodes — the SectionCard holds aria-labelledby
	// structure that must stay in the a11y tree throughout the tween.
	useGSAP(
		() => {
			const root = cardRef.current;
			if (root === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const stats = gsap.utils.toArray<HTMLElement>(
					root.querySelectorAll("[data-closure-stat]"),
				);

				gsap.set(root, { opacity: 0, scale: 0.98, y: 12 });
				if (stats.length > 0) {
					gsap.set(stats, { opacity: 0, y: 8 });
				}

				const tl = gsap.timeline({ defaults: { ease: EASE.out } });
				tl.to(root, { opacity: 1, scale: 1, y: 0, duration: DUR.lg }, 0);
				if (stats.length > 0) {
					tl.to(
						stats,
						{ opacity: 1, y: 0, stagger: 0.07, duration: DUR.md, ease: EASE.exit },
						"-=0.25",
					);
				}

				return () => {
					tl.kill();
					gsap.set(root, { clearProps: "opacity,transform" });
					if (stats.length > 0)
						gsap.set(stats, { clearProps: "opacity,transform" });
				};
			});

			return () => mm.revert();
		},
		{ scope: cardRef },
	);

	return (
		<div ref={cardRef}>
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

						{actionsReady && (
							<div className="mt-7 flex flex-col gap-4 animate-card-reveal motion-reduce:animate-none">
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
						)}
					</div>

				</div>
			</SectionCard>
		</div>
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
		<div data-closure-stat className="flex items-baseline gap-2 min-w-0 sm:justify-self-start">
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
