import type { ApiCard } from "@fsrs-japanese/shared-types";
import { assertNever, State } from "@fsrs-japanese/shared-types";

import { cn } from "@/lib/utils";

interface Props { card: ApiCard }

// The scheduler runs at request_retention = 0.85 (apps/api fsrs.service.ts),
// so 0.85 is the recall floor the curve decays toward before the next review.
const RETENTION_TARGET = 0.85;

// FSRS power forgetting curve: R(t) = 1 / (1 + t / (9·S)). At t = S, R ≈ 0.9.
function retrievability(t: number, stability: number): number {
	const s = Math.max(stability, 0.01);
	return 1 / (1 + t / (9 * s));
}

function stateLabel(state: State): string {
	switch (state) {
		case State.New: return "New";
		case State.Learning: return "Learning";
		case State.Relearning: return "Relearning";
		case State.Review: return "Review";
		default:
			return assertNever(state);
	}
}

function formatSpan(days: number): string {
	if (days < 1)
		return "under a day";
	if (days < 45)
		return `${Math.round(days)} days`;
	if (days < 365)
		return `${Math.round(days / 30)} months`;
	return `${(days / 365).toFixed(1)} years`;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The card's scheduling state shown as the FSRS forgetting curve: recall
 * decaying from the last review toward the 0.85 retention floor, with "today"
 * and "next review" marked on the curve. New / never-studied cards show a
 * quiet placeholder instead of a meaningless curve. Chrome-less by design —
 * the parent wraps this in a SectionCard.
 */
export function CardHistoryPanel({ card }: Props): React.JSX.Element {
	const isNew = card.state === State.New || card.reps === 0 || card.lastReview === null;

	if (isNew) {
		return (
			<div className="flex flex-col gap-4">
				<p className="max-w-measure-tight text-sm leading-relaxed text-faded-sumi">
					Not studied yet. The memory curve appears here after the first
					review, once Tomo has something to schedule.
				</p>
				<dl>
					<StatCell label="State" value={stateLabel(card.state)} />
				</dl>
			</div>
		);
	}

	// ── Geometry. A wide viewBox the SVG scales to fill the popup width. ──
	const VB_W = 760;
	const VB_H = 232;
	const L = 46; const R = 716; const T = 26; const B = 176; // plot box edges
	const BASE = B; // y for r = yFloor

	const stability = Math.max(card.stability, 0.01);
	const elapsed = Math.max(card.elapsedDays, 0);
	const sched = Math.max(card.scheduledDays, 0.5);
	const rNow = retrievability(elapsed, stability);
	const pctNow = Math.round(rNow * 100);
	const overdue = elapsed > sched;

	// Run a little past whichever of now / due / stability is furthest out.
	const tMax = Math.max(sched, elapsed, stability) * 1.45;

	// Cards live in the 85–100% band, so map a tight retention window (a hair
	// below the lowest plotted value, up to 100%) instead of 0–100%. This lets
	// the actual decay fill the chart's height rather than hugging the top.
	const yTop = 1;
	const yFloor = Math.max(0.5, Math.min(retrievability(tMax, stability), RETENTION_TARGET, rNow) - 0.04);

	const xOf = (t: number): number => L + (Math.min(t, tMax) / tMax) * (R - L);
	const yOf = (r: number): number => {
		const c = Math.max(yFloor, Math.min(yTop, r));
		return T + ((yTop - c) / (yTop - yFloor)) * (B - T);
	};

	// viewBox units → percentage of the chart box, so HTML overlay markers and
	// labels land exactly on their SVG coordinates regardless of render width.
	const pctX = (x: number): string => `${((x / VB_W) * 100).toFixed(2)}%`;
	const pctY = (y: number): string => `${((y / VB_H) * 100).toFixed(2)}%`;

	const STEPS = 60;
	const curve: string = Array.from({ length: STEPS + 1 }, (_, i) => {
		const t = (i / STEPS) * tMax;
		return `${i === 0 ? "M" : "L"} ${xOf(t).toFixed(1)} ${yOf(retrievability(t, stability)).toFixed(1)}`;
	}).join(" ");

	// Sumi wash under the curve up to today: "memory spent so far".
	const ASTEPS = 44;
	const elapsedClamped = Math.min(elapsed, tMax);
	const areaTop = Array.from({ length: ASTEPS + 1 }, (_, i) => {
		const t = (i / ASTEPS) * elapsedClamped;
		return `L ${xOf(t).toFixed(1)} ${yOf(retrievability(t, stability)).toFixed(1)}`;
	}).join(" ");
	const area = `M ${xOf(0).toFixed(1)} ${BASE} ${areaTop} L ${xOf(elapsedClamped).toFixed(1)} ${BASE} Z`;

	const guideY = yOf(RETENTION_TARGET);
	const todayX = xOf(elapsed);
	const todayY = yOf(rNow);
	const dueX = xOf(sched);
	const dueY = yOf(retrievability(sched, stability));

	// Keep the today / due axis labels from colliding when the two markers
	// sit close together (short interval): anchor each away from the other.
	const labelGap = Math.abs(dueX - todayX) < 70;
	// When the due marker lands in the rightmost band, its date label would
	// collide with the right-anchored "85% target" label; suppress the latter
	// (the dashed guide stays self-evident). Independent of viewport since the
	// SVG scales uniformly, so this only triggers on genuinely late schedules.
	const dueNearRight = dueX > L + 0.78 * (R - L);
	// When the card was reviewed today, the "today" dot sits on the last-review
	// origin and fully covers its tick; only draw the tick once it clears.
	const lastTickClear = todayX - xOf(0) > 9;

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
				Recall fades after each review. You
				’
				d remember this about
				{" "}
				<span className={cn("font-medium", overdue ? "text-inari-vermillion-deep" : "text-sumi-ink")}>
					{pctNow}
					%
				</span>
				{" "}
				of the time right now; Tomo brings it back before recall drops past the
				85% target.
			</p>

			{/* ── The forgetting curve. The SVG carries only the scalable shapes
          (guide, wash, curve); markers and labels live in an HTML overlay
          pinned to the same coordinates, so they stay legible from a
          phone-width popup up to the full 64rem desktop modal instead of
          shrinking with the viewBox. The box keeps the viewBox aspect so the
          overlay percentages map 1:1 onto the SVG. ─────────────────────── */}
			<div
				className="relative w-full"
				style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
				role="img"
				aria-label={`Memory curve: about ${pctNow} percent recall today, next review ${formatDate(card.due)}.`}
			>
				<svg
					viewBox={`0 0 ${VB_W} ${VB_H}`}
					className="absolute inset-0 h-full w-full"
					aria-hidden="true"
				>
					{/* 0.85 retention target guide */}
					<line
						x1={L}
						y1={guideY}
						x2={R}
						y2={guideY}
						className="text-faded-sumi/40"
						stroke="currentColor"
						strokeWidth="1"
						strokeDasharray="3 4"
						vectorEffect="non-scaling-stroke"
					/>

					{/* sumi wash: memory elapsed since the last review */}
					<path d={area} className="text-sumi-ink" fill="currentColor" fillOpacity={0.05} />

					{/* the curve, inked in on open; non-scaling-stroke holds it at 2.5px
              whether the popup is 320px or 960px across */}
					<path
						d={curve}
						pathLength={1}
						className="text-sumi-ink animate-memory-curve-draw"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
						style={{ strokeDasharray: 1 }}
					/>
				</svg>

				{/* Markers + labels at fixed CSS sizes, positioned by the shared
            geometry. Fades in just behind the stroke draw. */}
				<div
					className="animate-memory-fade-in pointer-events-none absolute inset-0"
					style={{ animationDelay: "700ms" }}
				>
					{/* last-review tick (hidden when the today dot covers it) */}
					{lastTickClear && (
						<span
							aria-hidden="true"
							className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-faded-sumi"
							style={{ left: pctX(xOf(0)), top: pctY(yOf(1)) }}
						/>
					)}
					{/* next review: hollow ring */}
					<span
						aria-hidden="true"
						className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-inari-vermillion-deep bg-warm-paper-raised"
						style={{ left: pctX(dueX), top: pctY(dueY) }}
					/>
					{/* today: filled dot + the live recall % above it */}
					<span
						aria-hidden="true"
						className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-inari-vermillion-deep"
						style={{ left: pctX(todayX), top: pctY(todayY) }}
					/>
					<span
						className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap font-mono text-xs font-semibold text-inari-vermillion-deep"
						style={{ left: pctX(todayX), top: `calc(${pctY(todayY)} - 0.6rem)` }}
					>
						{pctNow}
						%
					</span>

					{/* axis labels, dropped to the reserved row below the plot box */}
					<span
						className="absolute -translate-y-1/2 whitespace-nowrap text-[0.6875rem] text-faded-sumi"
						style={{ left: pctX(xOf(0)), top: pctY(BASE + 20) }}
					>
						{formatDate(card.lastReview as string)}
					</span>
					<span
						className={cn(
							"absolute -translate-y-1/2 whitespace-nowrap text-[0.6875rem] text-faded-sumi",
							labelGap ? "-translate-x-full" : "-translate-x-1/2",
						)}
						style={{ left: pctX(dueX), top: pctY(BASE + 20) }}
					>
						due
						{" "}
						{formatDate(card.due)}
					</span>

					{/* 85% target label on the same row; suppressed when the due label
              would collide with it at the right edge (the dashed guide stays
              self-evident). */}
					{!dueNearRight && (
						<span
							className="absolute -translate-x-full -translate-y-1/2 whitespace-nowrap text-[0.6875rem] text-faded-sumi"
							style={{ left: pctX(R), top: pctY(BASE + 20) }}
						>
							85% target
						</span>
					)}
				</div>
			</div>

			{/* ── Plain-language scheduling readout, as a stat strip ─────────── */}
			<dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-soft-hairline pt-5 sm:grid-cols-3 lg:grid-cols-5">
				<StatCell label="State" value={stateLabel(card.state)} />
				<StatCell label="Memory holds" value={`~${formatSpan(stability)}`} />
				<EaseCell difficulty={card.difficulty} />
				<StatCell label="Reviews" value={String(card.reps)} />
				<StatCell label="Lapses" value={String(card.lapses)} emphasize={card.lapses >= 3} />
				{card.isSuspended && <StatCell label="Status" value="Suspended" emphasize />}
			</dl>
		</div>
	);
}

function StatCell({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }): React.JSX.Element {
	return (
		<div className="flex flex-col gap-1">
			<dt className="font-mono text-sm uppercase tracking-[0.1em] text-faded-sumi">{label}</dt>
			<dd className={cn(
				"font-mono text-base tabular-nums leading-none",
				emphasize === true ? "font-semibold text-inari-vermillion-deep" : "text-sumi-ink",
			)}
			>
				{value}
			</dd>
		</div>
	);
}

// FSRS difficulty (0–10, higher = harder) shown as its inverse, "ease", so a
// fuller bar reads as the intuitive "good" direction. The /10 anchor makes the
// number interpretable; the fill stays neutral (no warning color, color-blind
// safe).
function EaseCell({ difficulty }: { difficulty: number }): React.JSX.Element {
	const ease = Math.max(0, Math.min(10, 10 - difficulty));
	const pct = (ease / 10) * 100;
	return (
		<div className="flex flex-col gap-1">
			<dt className="font-mono text-sm uppercase tracking-[0.1em] text-faded-sumi">Ease</dt>
			<dd className="flex items-center gap-2">
				<span className="whitespace-nowrap font-mono text-base tabular-nums leading-none text-sumi-ink">
					{ease.toFixed(1)}
					{" "}
					<span className="text-faded-sumi">/ 10</span>
				</span>
				<span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-inset">
					<span className="block h-full rounded-full bg-faded-sumi/70" style={{ width: `${pct}%` }} />
				</span>
			</dd>
		</div>
	);
}
