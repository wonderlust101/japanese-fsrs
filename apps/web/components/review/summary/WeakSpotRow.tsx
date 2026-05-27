"use client";

import type { SessionWeakSpot } from "@fsrs-japanese/shared-types";

import { useState } from "react";

interface Props {
	weakSpot: SessionWeakSpot;
	meaning?: string | undefined;
	/**
	 * Quiet "Roll back" affordance — surfaced only when the parent has a
	 *  review-log id for this card (i.e. the user is viewing the summary
	 *  they just finished).
	 */
	onRollback?: ((weakSpot: SessionWeakSpot) => void) | undefined;
	rollbackPending?: boolean;
}

// Lapse-tier thresholds. Aligned with `cards-results-table.tsx` so the
// summary surface speaks the same tier language a learner sees in the
// cards browser:
//   <4      → quiet "Mark"   (early; not yet drifting)
//   4..7    → warning "Drift" (matches HealthBadge's "Drifting")
//   ≥8      → vermillion "Weak" (matches HealthBadge's "Weak spot")

interface LapseMark {
	kanji: string;
	label: string;
	toneClass: string;
	bgClass: string;
}

function lapseMarkFor(lapses: number | undefined): LapseMark {
	if (lapses === undefined || lapses < 4) {
		return {
			kanji: "印",
			label: "Mark",
			toneClass: "text-sumi-ink",
			bgClass: "bg-cream-inset/60",
		};
	}
	if (lapses < 8) {
		return {
			kanji: "注",
			label: "Drift",
			toneClass: "text-warning",
			bgClass: "bg-warning-soft",
		};
	}
	return {
		kanji: "弱",
		label: "Weak",
		toneClass: "text-inari-vermillion-deep",
		bgClass: "bg-vermillion-wash/30",
	};
}

/**
 * Weak-spot row, modelled on `CardListItem` (deck detail) but tuned for
 * the post-session summary.
 *
 * Chrome: hairline frame on a paper card. No vermillion brand stripe —
 * the parent SectionCard's error-red stripe already frames the list.
 *
 * Layout (collapsed):
 *   ┌──────┬───────────────────────────────────┐
 *   │ 弱   │ word  reading                     │
 *   │ Weak │ meaning                       ⌄  │  ← expand chevron
 *   │  17  │                                   │     when diagnosis present
 *   └──────┴───────────────────────────────────┘
 *
 * Layout (expanded — diagnosis present):
 *   ┌──────┬───────────────────────────────────┐
 *   │ 弱   │ word  reading                     │
 *   │ Weak │ meaning                       ⌃  │
 *   │  17  │                                   │
 *   ├──────┴───────────────────────────────────┤
 *   │ Diagnosis prose…                         │
 *   │ Prescription prose (when present)…       │
 *   └──────────────────────────────────────────┘
 *
 * When a diagnosis is present, the entire top row is a <button> that
 * toggles the disclosure panel below. Rows without a diagnosis are
 * non-interactive (no card-detail navigation from this surface). The
 * Roll back button is an absolute-positioned sibling of the disclosure
 * button so it stays a separate, focusable control.
 */
export function WeakSpotRow({
	weakSpot,
	meaning,
	onRollback,
	rollbackPending,
}: Props): React.JSX.Element {
	const mark = lapseMarkFor(weakSpot.lapses);
	const hasDiagnosis = weakSpot.diagnosis !== null && weakSpot.diagnosis.length > 0;
	const [expanded, setExpanded] = useState(false);

	const diagnosisId = `weak-spot-diagnosis-${weakSpot.weakSpotId}`;

	const topRowInner = (
		<div className="flex">
			<div className={`flex w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-soft-hairline px-1 py-3 sm:w-16 sm:py-3.5 ${mark.bgClass}`}>
				<span
					aria-hidden="true"
					lang="ja"
					className={`font-display text-base leading-none ${mark.toneClass}`}
				>
					{mark.kanji}
				</span>
				<span className="font-mono text-sm text-faded-sumi">
					{mark.label}
				</span>
				{weakSpot.lapses !== undefined && (
					<span
						className={`mt-0.5 font-display text-base leading-none tabular-nums ${mark.toneClass}`}
						aria-label={`${weakSpot.lapses} lapses`}
					>
						{weakSpot.lapses}
					</span>
				)}
			</div>

			<div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5 sm:py-4 sm:pr-28">
				<div className="flex min-w-0 items-baseline gap-3">
					<span
						lang="ja"
						className="min-w-0 truncate font-japanese text-lg font-semibold leading-tight text-sumi-ink"
					>
						{weakSpot.word}
					</span>
					{weakSpot.reading !== null && weakSpot.reading.length > 0 && (
						<span
							lang="ja"
							className="shrink-0 truncate font-japanese text-sm leading-tight text-faded-sumi"
						>
							{weakSpot.reading}
						</span>
					)}
				</div>

				<div className="mt-1.5">
					<span className="block min-w-0 truncate text-sm leading-snug text-sumi-ink/80">
						{meaning !== undefined && meaning !== "" ? meaning : "—"}
					</span>
				</div>
			</div>

			{/* Right-edge state slot. When a diagnosis is available, shows the
              disclosure chevron (decorative — the row itself is the button).
              When no diagnosis is loaded yet, shows a quiet "Diagnosing…"
              pill so the learner knows the AI pass is still in flight. */}
			{hasDiagnosis
				? (
						<div className="flex shrink-0 items-start pr-3 pt-3 sm:pr-4 sm:pt-4 text-faded-sumi">
							<ChevronGlyph open={expanded} />
						</div>
					)
				: (
						<div
							aria-hidden="true"
							className="flex shrink-0 items-start pr-3 pt-3 sm:pr-4 sm:pt-4"
						>
							<span className="inline-flex items-center gap-2 rounded-xs border border-soft-hairline bg-cream-inset/60 px-1.5 py-0.5 font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
								<span className="h-1.5 w-1.5 rounded-full bg-faded-sumi/70 animate-pulse motion-reduce:animate-none" />
								Diagnosing…
							</span>
						</div>
					)}
		</div>
	);

	return (
		<li className="group/weak relative overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised ui-motion-colors hover:bg-cream-inset/40">
			{hasDiagnosis
				? (
						<button
							type="button"
							onClick={() => setExpanded(v => !v)}
							aria-expanded={expanded}
							aria-controls={diagnosisId}
							className="block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
						>
							{topRowInner}
						</button>
					)
				: (
						<div>{topRowInner}</div>
					)}

			{/* Diagnosis reveal — animates in via the project's animate-card-reveal
          keyframe (250ms cubic-bezier). Honors reduced-motion. */}
			{hasDiagnosis && expanded && (
				<div
					id={diagnosisId}
					className="border-t border-soft-hairline bg-cream-inset/30 px-4 py-3 animate-card-reveal motion-reduce:animate-none sm:px-5 sm:py-4"
				>
					<p className="font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
						Diagnosis
					</p>
					<p className="mt-1.5 max-w-measure text-sm leading-relaxed text-sumi-ink">
						{weakSpot.diagnosis}
					</p>
					{weakSpot.prescription !== null && weakSpot.prescription.length > 0 && (
						<>
							<p className="mt-3 font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
								Suggested approach
							</p>
							<p className="mt-1.5 max-w-measure text-sm italic leading-relaxed text-faded-sumi">
								{weakSpot.prescription}
							</p>
						</>
					)}
				</div>
			)}

			{onRollback !== undefined && (
				<button
					type="button"
					onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRollback(weakSpot); }}
					disabled={rollbackPending === true}
					className="absolute bottom-2 right-3 hidden min-h-[28px] items-center rounded-xs px-2 py-1 font-mono text-sm text-faded-sumi underline-offset-2 hover:bg-cream-inset/70 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
				>
					{rollbackPending === true ? "Rolling back…" : "Roll back"}
				</button>
			)}
		</li>
	);
}

// Inline chevron — rotates 180° when open. Uses currentColor so it picks
// up the hover/focus state of the parent button.
function ChevronGlyph({ open }: { open: boolean }): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
		>
			<path d="M3 4.5 L6 7.5 L9 4.5" />
		</svg>
	);
}
