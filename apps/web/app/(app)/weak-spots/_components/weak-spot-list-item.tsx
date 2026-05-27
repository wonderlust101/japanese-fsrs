"use client";

import type { ApiWeakSpotListItem } from "@fsrs-japanese/shared-types";
import type { JlptPillLevel } from "@/components/ui/Pill";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

import { WEAK_SPOT_DRILL_ENABLED } from "./weak-spots-types";

interface WeakSpotListItemProps {
	weakSpot: ApiWeakSpotListItem;
	onOpen: (weakSpotId: string) => void;
	onResolve: (weakSpotId: string) => void;
	onReopen: (weakSpotId: string) => void;
	isMutating: boolean;
}

// Lapse-count threshold at which a card is treated as a leech. Mirrors the
// backend `LEECH_THRESHOLD` default (8); used here only to tint the count.
const LEECH_THRESHOLD = 8;

/**
 * Single weakSpot row, three tiers of decreasing weight:
 *
 *   1. Identity — kanji (largest) with the reading inline beside it (not
 *      stacked furigana) and the JLPT level pill. JLPT sits here, with the
 *      word it describes, so the meta line carries a single accent.
 *   2. Meaning — its own line, a middle tier between the ink kanji and the
 *      faded meta.
 *   3. Meta — a diagnosis-state dot, the lapse count as the row's one accent
 *      (colored text by severity, no box: faded → ink → vermillion past the
 *      leech threshold), and the deck. Timestamps and diagnosis prose live in
 *      the detail dialog.
 *
 * Action cluster: the resolve/reopen action as a visible button (44px touch
 * target on mobile). The `Drill` button is gated behind
 * `WEAK_SPOT_DRILL_ENABLED` (parked out of the MVP). There is no overflow
 * kebab; "View details" is the whole-row click.
 *
 * Layout adapts at `sm`: below it the row is a column — content owns the full
 * width and the action cluster drops beneath it, left-aligned via `self-start`
 * (so it hugs its buttons rather than stretching, leaving the surrounding band
 * as live "open details" surface). This keeps the kanji/meaning/meta legible
 * on a phone instead of competing with the buttons for horizontal space, which
 * matters once `Drill` ships a second button. At `sm`+ it returns to the
 * inline `justify-between` row with the cluster pinned right.
 *
 * Interaction: the whole row is one click target that opens the detail dialog,
 * built with the stretched-target pattern (a full-bleed primary button under
 * the pointer-events-none content) so the action buttons stay independently
 * clickable and focusable without nested buttons or `stopPropagation` hacks.
 * Hover tints the row.
 *
 * Orphan rows (`cardId === null`) render a dimmed "card no longer exists" hero
 * with no meta line and no actions; only the row-click View-details path
 * remains.
 */
export function WeakSpotListItem({
	weakSpot,
	onOpen,
	onResolve,
	onReopen,
	isMutating,
}: WeakSpotListItemProps): React.JSX.Element {
	const isOrphan = weakSpot.cardId === null;
	const lapseCount = weakSpot.lapses ?? 0;
	const hasDiagnosis = weakSpot.diagnosis !== null && weakSpot.diagnosis !== "";
	const label = weakSpot.word ?? "this card";

	return (
		<li className="group relative flex flex-col gap-3 border-b border-soft-hairline px-4 py-5 transition-colors last:border-b-0 hover:bg-cream-inset/60 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-6">
			{/* Stretched primary action: covers the whole row and opens the detail
          dialog. Sits beneath the content (which is pointer-events-none) so a
          click anywhere that isn't the action cluster lands here, while Drill
          and the kebab raise themselves above it. The focus ring outlines the
          row. */}
			<button
				type="button"
				onClick={() => onOpen(weakSpot.id)}
				aria-label={`View details for ${label}`}
				className="absolute inset-0 rounded-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-2px]"
			/>

			{/* ── Content (non-interactive; clicks fall through to the button) ── */}
			<div className="pointer-events-none min-w-0 flex-1">
				{/* Tier 1 — identity: kanji (dominant) + reading inline beside it
            (not stacked furigana), then the JLPT pill. JLPT belongs with the
            word it describes, and seating it here keeps the meta line to a
            single accent. */}
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span className="flex items-center gap-2">
						<span className="font-display text-lg leading-tight text-sumi-ink">
							<span className={isOrphan ? "italic text-faded-sumi" : ""}>
								{weakSpot.word ?? "Card no longer exists"}
							</span>
						</span>
						{weakSpot.reading !== null && weakSpot.reading !== "" && (
							<span className="text-sm leading-none text-faded-sumi">{weakSpot.reading}</span>
						)}
					</span>
					{weakSpot.jlptLevel !== null && (
						<Pill variant="level" tone={weakSpot.jlptLevel as JlptPillLevel} size="sm">
							{jlptLabel(weakSpot.jlptLevel)}
						</Pill>
					)}
				</div>

				{/* Tier 2 — meaning on its own line, a middle tier between the ink
            kanji and the faded meta (darker than the reading, lighter than
            the kanji). */}
				{weakSpot.meaning !== null && (
					<p className="mt-1 text-sm text-sumi-ink/80">{weakSpot.meaning}</p>
				)}

				{/* Tier 3 — meta line: diagnosis dot, then the lapse count as the
            single accent (colored text by severity, no box) and the deck. One
            accent per line keeps the kanji dominant and the row legible. */}
				{!isOrphan && (
					<div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-faded-sumi">
						<DiagnosisDot diagnosed={hasDiagnosis} />
						{weakSpot.resolved
							? (
									<span className="text-aizome-indigo">Resolved</span>
								)
							: (
									<span className={lapseToneClass(lapseCount)}>
										<span className="tabular-nums">{lapseCount}</span>
										{" "}
										{lapseCount === 1 ? "lapse" : "lapses"}
									</span>
								)}
						{weakSpot.deckName !== null && (
							<>
								<MetaSep />
								<span className="truncate normal-case">{weakSpot.deckName}</span>
							</>
						)}
					</div>
				)}
			</div>

			{/* ── Action cluster: visible buttons, raised above the stretched
          button. The overflow kebab is gone; View details is the row click. ── */}
			{!isOrphan && (
				<div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-2 self-start sm:self-auto">
					{WEAK_SPOT_DRILL_ENABLED && !weakSpot.resolved && (
						<ButtonLink
							href={`/weak-spots/drill/setup?cardId=${weakSpot.cardId}`}
							variant="secondary"
							size="sm"
							className="min-h-11 sm:min-h-0"
						>
							Drill
						</ButtonLink>
					)}
					{weakSpot.resolved
						? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="min-h-11 sm:min-h-0"
									loading={isMutating}
									onClick={() => onReopen(weakSpot.id)}
								>
									Reopen
								</Button>
							)
						: (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="min-h-11 sm:min-h-0"
									loading={isMutating}
									onClick={() => onResolve(weakSpot.id)}
								>
									Mark resolved
								</Button>
							)}
				</div>
			)}
		</li>
	);
}

// ─── Meta helpers ──────────────────────────────────────────────────────────────

function MetaSep(): React.JSX.Element {
	return <span aria-hidden="true" className="text-faded-sumi/60">·</span>;
}

function jlptLabel(level: string): string {
	return level === "beyond_jlpt" ? "Beyond" : level;
}

// ─── Diagnosis state dot ───────────────────────────────────────────────────────

function DiagnosisDot({ diagnosed }: { diagnosed: boolean }): React.JSX.Element {
	return (
		<span
			role="img"
			aria-label={diagnosed ? "Diagnosed" : "Not yet diagnosed"}
			className={[
				"inline-block h-1.5 w-1.5 shrink-0 rounded-full",
				diagnosed ? "bg-aizome-indigo" : "border border-soft-hairline bg-transparent",
			].join(" ")}
		/>
	);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tint the lapse count by severity within the restrained palette: faded below
 * 5, ink at 5–7, vermillion at/above the leech threshold so the worst
 * offenders read first. Text only, no box, so it stays the row's single quiet
 * accent without competing with the JLPT pill in the hero.
 */
function lapseToneClass(count: number): string {
	if (count >= LEECH_THRESHOLD)
		return "text-inari-vermillion-deep";
	if (count >= 5)
		return "text-sumi-ink";
	return "text-faded-sumi";
}
