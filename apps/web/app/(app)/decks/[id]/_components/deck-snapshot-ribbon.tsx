"use client";

import type { ApiDeckWithStats } from "@fsrs-japanese/shared-types";

import { useEffect, useState } from "react";

import { Time } from "@/components/ui/Time";
import { TomoLoader } from "@/components/ui/TomoLoader";

interface Props {
	deck: ApiDeckWithStats | null | undefined;
	loading: boolean;
}

/**
 * Full-width snapshot ledger for Deck Detail. Replaces the old sidebar
 * `SectionCard`, which stole horizontal width from the card list.
 *
 * The figures are organised into three *named* zones rather than one flat run
 * of identical numbers, so the eye chunks the row instead of reading a wall of
 * digits:
 *
 *   今 Due now   →  what to study right now (the only actionable zone)
 *   蔵 Library   →  what the deck holds
 *   暦 History   →  when it last changed
 *
 * Each zone leads with one large anchor figure; the rest trail as small
 * supporting figures. The vermillion-kanji eyebrow is the same ornament idiom
 * as `PageHeader`, so the zoning reads as Tomo, not as invented chrome.
 *
 * Two earned delight moments, both state-driven (not decoration):
 *   - When nothing is due, the Due zone cools from vermillion to aizome and
 *     reads "Clear" with a checkmark — Tomo's calm caught-up beat.
 *   - Mature% renders as a monochrome micro-bar that fills once on mount via
 *     `--ease-out-quint`. Gated to mount so query refetches don't replay it;
 *     reduced-motion users get the filled bar with no animation.
 */
export function DeckSnapshotRibbon({ deck, loading }: Props): React.JSX.Element {
	// Flips true one tick after mount so the mature bar can transition from 0 to
	// its target width. Stored in state (not derived from `deck`) so a TanStack
	// refetch — which re-renders without remounting — never restarts the fill.
	const [mounted, setMounted] = useState(false);
	useEffect(() => { setMounted(true); }, []); // eslint-disable-line react/set-state-in-effect -- flips true one tick after mount so the mature bar can transition from 0

	const dueCount = deck?.dueCount ?? 0;
	const caughtUp = !loading && dueCount === 0;
	const maturePct = deck != null && deck.cardCount > 0
		? Math.round((deck.matureCount / deck.cardCount) * 100)
		: null;

	// One loader for the whole ribbon (it's backed by a single deck query), so
	// the zones reveal together instead of three placeholders resolving in step.
	if (loading) {
		return (
			<section
				aria-label="Deck snapshot"
				aria-busy="true"
				className="flex items-center justify-center border-y border-soft-hairline py-8"
			>
				<TomoLoader size="block" />
			</section>
		);
	}

	return (
		<section
			aria-label="Deck snapshot"
			className="flex flex-wrap items-stretch gap-x-8 gap-y-6 border-y border-soft-hairline py-5 sm:gap-x-10"
		>
			{/* ── 今 Due now ─ the one actionable zone ─────────────────────── */}
			<Zone kanji="今" caption="Due now" tone={caughtUp ? "calm" : "hot"}>
				{caughtUp
					? (
							<div className="flex items-baseline gap-2">
								<Lead tone="calm" aria-hidden="true">✓</Lead>
								<span className="text-sm font-medium text-aizome-indigo">Clear</span>
								<span className="text-xs text-faded-sumi">nothing due</span>
							</div>
						)
					: (
							<div className="flex items-baseline gap-3">
								<Lead tone="hot">{dueCount}</Lead>
								<Supporting>
									<Figure value={deck?.dueNewCount ?? 0} label="new" />
									<Figure value={deck?.dueReviewCount ?? 0} label="review" />
								</Supporting>
							</div>
						)}
			</Zone>

			<Divider />

			{/* ── 蔵 Library ─ what the deck holds ─────────────────────────── */}
			<Zone kanji="蔵" caption="Library" tone="neutral">
				<div className="flex items-baseline gap-3">
					<Lead tone="ink">{deck?.cardCount ?? 0}</Lead>
					<Supporting>
						<Figure value={deck?.newCount ?? 0} label="new" />
						{maturePct !== null && <MatureFigure pct={maturePct} mounted={mounted} />}
					</Supporting>
				</div>
			</Zone>

			<Divider />

			{/* ── 習 Last studied ─ most recent review across the deck's cards ───
          Backed by lastReviewedAt (MAX(cards.last_review)). Null when no card
          has been reviewed yet, which reads as "Not yet" rather than a date —
          a more learner-relevant signal than the deck-row edit date. */}
			<Zone kanji="習" caption="Last studied" tone="neutral">
				<div className="flex items-baseline gap-3">
					{deck?.lastReviewedAt != null
						? (
								<span className="text-[1.375rem] font-medium leading-none text-sumi-ink/90">
									<Time value={deck.lastReviewedAt}>{formatRelativeDay(deck.lastReviewedAt)}</Time>
								</span>
							)
						: (
								<span className="text-[1.375rem] font-medium leading-none text-faded-sumi">
									Not yet
								</span>
							)}
					<span className="text-xs text-faded-sumi">
						created
						{" "}
						{deck?.createdAt ? <Time value={deck.createdAt}>{formatMonthYear(deck.createdAt)}</Time> : "—"}
					</span>
				</div>
			</Zone>
		</section>
	);
}

// ── Zone scaffold ──────────────────────────────────────────────────────────

type ZoneTone = "hot" | "calm" | "neutral";

const ZONE_KANJI_CLASS: Record<ZoneTone, string> = {
	hot: "text-inari-vermillion",
	calm: "text-aizome-indigo",
	neutral: "text-inari-vermillion",
};

/**
 * One labelled zone: vermillion-kanji eyebrow over its figure block. The
 * eyebrow reuses PageHeader's `font-display` kanji + small-caps mono label
 * pairing so the zoning is recognisably Tomo.
 */
function Zone({
	kanji,
	caption,
	tone,
	children,
}: {
	kanji: string;
	caption: string;
	tone: ZoneTone;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className="flex min-w-0 flex-col gap-2 sm:flex-1">
			<p className="flex items-baseline gap-2 font-mono text-sm uppercase tracking-[0.09em] text-faded-sumi">
				<span
					lang="ja"
					aria-hidden="true"
					className={`font-display text-sm leading-none translate-y-[0.05em] transition-colors duration-300 ${ZONE_KANJI_CLASS[tone]}`}
				>
					{kanji}
				</span>
				<span>{caption}</span>
			</p>
			{children}
		</div>
	);
}

const LEAD_TONE_CLASS: Record<"hot" | "calm" | "ink", string> = {
	hot: "font-semibold text-inari-vermillion-deep",
	calm: "font-semibold text-aizome-indigo",
	ink: "font-medium text-sumi-ink",
};

/**
 * The anchor figure for a zone. Every zone's Lead shares one size and
 * line-height; because the zones' value rows all start at the same y (their
 * eyebrows are equal height), one uniform size means the leads sit on a single
 * baseline across the whole bar. Hierarchy between zones rides on color and
 * weight, not size, so the row stays aligned.
 */
function Lead({
	tone,
	children,
	...rest
}: {
	tone: "hot" | "calm" | "ink";
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
	return (
		<span
			className={`font-mono text-[1.375rem] leading-none tabular-nums transition-colors duration-300 ${LEAD_TONE_CLASS[tone]}`}
			{...rest}
		>
			{children}
		</span>
	);
}

/** Inline rail of small trailing figures that support the zone's lead. */
function Supporting({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-faded-sumi">{children}</span>;
}

function Figure({ value, label }: { value: number; label: string }): React.JSX.Element {
	return (
		<span className="whitespace-nowrap">
			<span className="font-mono tabular-nums text-sumi-ink/85">{value}</span>
			{" "}
			{label}
		</span>
	);
}

/**
 * Mature%, rendered as a number plus a real progress meter so deck health is
 * glanceable. Matches the mature bar on the Decks page (deck-card.tsx):
 * `soft-hairline/45` track with an `inari-vermillion-deep/70` fill, so the
 * meter reads consistently across both surfaces. The fill grows 0→pct via
 * `scaleX` (composited, never animating width), easing with the project's
 * `--ease-out-quint`; reduced motion shows it full.
 */
function MatureFigure({ pct, mounted }: { pct: number; mounted: boolean }): React.JSX.Element {
	return (
		<span className="flex items-center gap-2 whitespace-nowrap">
			<span>
				<span className="font-mono tabular-nums text-sumi-ink/85">
					{pct}
					%
				</span>
				{" "}
				mature
			</span>
			<span
				aria-hidden="true"
				className="relative h-1.5 w-16 overflow-hidden rounded-full bg-soft-hairline/45"
			>
				<span
					className="absolute inset-y-0 left-0 origin-left rounded-full bg-inari-vermillion-deep/70 motion-reduce:transition-none"
					style={{
						width: `${pct}%`,
						transform: mounted ? "scaleX(1)" : "scaleX(0)",
						transition: "transform 700ms var(--ease-out-quint)",
					}}
				/>
			</span>
		</span>
	);
}

/**
 * Hairline zone divider. Hidden below `sm` so that when the zones wrap onto
 * separate rows on narrow screens the rule doesn't dangle between them.
 */
function Divider(): React.JSX.Element {
	return <div aria-hidden="true" className="hidden w-px self-stretch bg-soft-hairline sm:block" />;
}

function formatRelativeDay(iso: string): string {
	const date = new Date(iso);
	const today = new Date();
	const diffMs = today.getTime() - date.getTime();
	const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	if (days <= 0)
		return "Today";
	if (days === 1)
		return "Yesterday";
	if (days < 7)
		return `${days} days ago`;
	if (days < 30)
		return `${Math.floor(days / 7)} wk ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthYear(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
