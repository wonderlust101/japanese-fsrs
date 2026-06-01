"use client";

import type { ApiForecastDay } from "@fsrs-japanese/shared-types";
import { useMemo, useRef, useState } from "react";

import { QuietLink } from "@/components/ui/QuietLink";
import { SectionCard } from "@/components/ui/SectionCard";
import { useEnterSettle } from "@/hooks/use-enter-settle";
import { STAGGER } from "@/lib/motion/easings";

import {
	addDaysToDateKey,
	calendarDateKeyFromApiDate,
	dateNumberFromDateKey,
	dayLabelForDateKey,
} from "./today-calendar";
import {
	formatCompactCount,
	safeNonNegativeInteger,
} from "./today-format";

// ── Layout constants ─────────────────────────────────────────────────────────
// 7-day horizon (today + next 6). On narrow screens the last 2 days are
// visually hidden — the chart fills 168px tall.
const HORIZON_DAYS = 7;
const MOBILE_VISIBLE_DAYS = 5;
const CHART_HEIGHT = 168;

// ── Segment tokens ───────────────────────────────────────────────────────────
// Same three segments, sorted differently for stacking vs legend display.

export type WeekRhythmState = "default" | "error";

type SegmentKey = "backlog" | "review" | "new";

interface Segment {
	key: SegmentKey;
	label: string;
	color: string;
}

const SEGMENT_BY_KEY = {
	backlog: { key: "backlog", label: "Overdue", color: "var(--color-queue-backlog-mark)" },
	review: { key: "review", label: "Due", color: "var(--color-queue-review-mark)" },
	new: { key: "new", label: "New", color: "var(--color-queue-new-mark)" },
} satisfies Record<SegmentKey, Segment>;

// The stack uses flex-col-reverse, so the first array entry renders at the
// top: backlog (top) → review (middle) → new (bottom).
const STACK_SEGMENTS: Segment[] = [
	SEGMENT_BY_KEY.backlog,
	SEGMENT_BY_KEY.review,
	SEGMENT_BY_KEY.new,
];

const LEGEND_SEGMENTS: Segment[] = [
	SEGMENT_BY_KEY.new,
	SEGMENT_BY_KEY.review,
	SEGMENT_BY_KEY.backlog,
];

interface WeekRhythmStripProps {
	state: WeekRhythmState;
	todayKey: string;
	apiDays: ReadonlyArray<ApiForecastDay>;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RhythmDay {
	key: string;
	label: string;
	dateNum: number;
	total: number;
	newCnt: number;
	review: number;
	backlog: number;
	isToday: boolean;
}

// ── Day computation ──────────────────────────────────────────────────────────
// Trim the 14-day API payload down to the 7-day horizon starting at todayKey.

function buildDays(
	apiDays: ReadonlyArray<ApiForecastDay>,
	todayKey: string,
): RhythmDay[] {
	const byKey = new Map<string, ApiForecastDay>();
	for (const day of apiDays) {
		byKey.set(calendarDateKeyFromApiDate(day.date), day);
	}

	const out: RhythmDay[] = [];
	for (let i = 0; i < HORIZON_DAYS; i += 1) {
		const key = addDaysToDateKey(todayKey, i);
		const day = byKey.get(key);
		const newCnt = safeNonNegativeInteger(day?.newCount);
		const review = safeNonNegativeInteger(day?.reviewCount);
		const backlog = safeNonNegativeInteger(day?.backlogCount);
		out.push({
			key,
			label: dayLabelForDateKey(key),
			dateNum: dateNumberFromDateKey(key),
			total: newCnt + review + backlog,
			newCnt,
			review,
			backlog,
			isToday: i === 0,
		});
	}
	return out;
}

// ── Public component ─────────────────────────────────────────────────────────
// SectionCard provides the kanji 週 + "The week ahead" label, the hairline
// divider rule, and the aria-labelledby plumbing between <section> and <h2>.
// The "See the next two weeks →" QuietLink rides in the header's right slot.

export function WeekRhythmStrip({
	state,
	todayKey,
	apiDays,
}: WeekRhythmStripProps): React.JSX.Element {
	// Hooks must run unconditionally and in a stable order, so they precede every
	// early return. Memoize the per-day derivation chain so the 14-day projection
	// only runs when its inputs change (the forecast payload or today's date key);
	// without this, every parent re-render walks the loop over identical data.
	const days = useMemo(() => buildDays(apiDays, todayKey), [apiDays, todayKey]);
	const scaleMax = useMemo(() => roundUpToNice(peakCountForDays(days)), [days]);
	const [glossaryOpen, setGlossaryOpen] = useState(false);
	const isEmptyForecast = days.every(day => day.total === 0);

	// Day-cell settle on mount (per docs/motion/DASHBOARD_MOTION_SPEC.md §2.7):
	// the bar columns rise + fade in with a short stagger. `opacity` (not
	// autoAlpha) because each cell's `aria-label` is the only place that day's
	// counts reach AT — it must stay in the a11y tree through the tween. The ref
	// only attaches in the normal branch; in the error/empty branches the hook
	// no-ops (null root). Gated behind prefers-reduced-motion: no-preference.
	const barsRef = useRef<HTMLOListElement>(null);
	useEnterSettle(barsRef, {
		copySelector: "[data-rhythm-cell]",
		copyY: 8,
		copyStagger: STAGGER.cells,
		copyDuration: 0.35,
		deps: [days],
	});

	if (state === "error") {
		return (
			<SectionCard
				id="week-rhythm"
				kanji="週"
				label="The week ahead"
				description="Your review queue, day by day."
				variant="chart"
				chrome="chart"
				rightContent={<QuietLink href="/insights/forecast">See the next two weeks →</QuietLink>}
			>
				<p className="mt-4 font-mono text-xs text-faded-sumi">
					Could not load the next seven days. Refresh to retry.
				</p>
			</SectionCard>
		);
	}

	if (isEmptyForecast) {
		return (
			<SectionCard
				id="week-rhythm"
				kanji="週"
				label="The week ahead"
				description="Your review queue, day by day."
				variant="chart"
				chrome="chart"
				rightContent={<QuietLink href="/insights/forecast">See the next two weeks →</QuietLink>}
			>
				<EmptyForecast />
			</SectionCard>
		);
	}

	return (
		<SectionCard
			id="week-rhythm"
			kanji="週"
			label="The week ahead"
			variant="chart"
			chrome="chart"
			description="Your review queue, day by day."
			rightContent={<QuietLink href="/insights/forecast">See the next two weeks →</QuietLink>}
		>
			<div className="mt-5">
				<ol
					ref={barsRef}
					className="flex items-end gap-2 sm:gap-2 lg:gap-3"
					style={{ height: `${CHART_HEIGHT}px` }}
					aria-label="Review forecast for the week ahead"
				>
					{days.map((day, i) => (
						<BarColumn
							key={day.key}
							day={day}
							dayIndex={i}
							scaleMax={scaleMax}
							mobileHidden={i >= MOBILE_VISIBLE_DAYS}
						/>
					))}
				</ol>

				<hr aria-hidden="true" className="border-0 border-t border-soft-hairline" />

				<ol aria-hidden="true" className="mt-3 flex items-start gap-2 sm:gap-2 lg:gap-3">
					{days.map((day, i) => (
						<li
							key={day.key}
							className={[
								"flex-1 text-center",
								day.isToday ? "text-sumi-ink font-semibold" : "text-faded-sumi",
								i >= MOBILE_VISIBLE_DAYS ? "hidden sm:block" : "",
							].join(" ")}
						>
							<div className="font-mono tabular-nums text-xs">
								{day.isToday ? "Today" : day.label}
							</div>
							<div className="mt-0.5 hidden font-mono tabular-nums text-sm text-faded-sumi sm:block">
								{day.isToday ? <span className="text-sumi-ink">{day.dateNum}</span> : day.dateNum}
							</div>
						</li>
					))}
				</ol>
			</div>

			<div className="mt-5 flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-0">
				<Legend />
				<GlossaryToggle open={glossaryOpen} onToggle={() => setGlossaryOpen(o => !o)} />
			</div>

			{glossaryOpen && <Glossary />}
		</SectionCard>
	);
}

// ── Chart components ─────────────────────────────────────────────────────────

interface BarColumnProps {
	day: RhythmDay;
	dayIndex: number;
	scaleMax: number;
	mobileHidden?: boolean;
}

function BarColumn({ day, dayIndex, scaleMax, mobileHidden = false }: BarColumnProps): React.JSX.Element {
	const ratio = scaleMax > 0 ? day.total / scaleMax : 0;
	const barHeight = day.total === 0
		? 1
		: Math.max(2, Math.round(ratio * (CHART_HEIGHT)));

	return (
		<li
			data-rhythm-cell
			className={[
				"h-full min-w-0 flex-1 flex-col items-center justify-end",
				mobileHidden ? "hidden sm:flex" : "flex",
			].join(" ")}
			aria-label={`${day.isToday ? "Today" : day.label} ${day.dateNum}: ${day.total} cards (${day.newCnt} new, ${day.review} review, ${day.backlog} overdue)`}
		>
			<span
				className={[
					"mb-1 max-w-full truncate font-mono tabular-nums leading-none",
					day.isToday
						? "text-xs font-semibold text-sumi-ink"
						: "text-sm text-faded-sumi",
				].join(" ")}
			>
				{formatCompactCount(day.total)}
			</span>

			<StackedBar day={day} dayIndex={dayIndex} height={barHeight} />
		</li>
	);
}

interface StackedBarProps {
	day: RhythmDay;
	dayIndex: number;
	height: number;
}

function StackedBar({ day, height }: StackedBarProps): React.JSX.Element {
	const visibleSegments = STACK_SEGMENTS
		.map(segment => ({
			...segment,
			value: segment.key === "backlog"
				? day.backlog
				: segment.key === "review"
					? day.review
					: day.newCnt,
		}))
		.filter(segment => segment.value > 0);
	const animationKey = `${day.key}-${day.total}-${day.backlog}-${day.review}-${day.newCnt}`;

	if (day.total === 0 || visibleSegments.length === 0) {
		return (
			<span
				key={`empty-${animationKey}`}
				aria-hidden="true"
				className="w-full max-w-[44px] origin-bottom rounded-t-[1px] bg-soft-hairline sm:max-w-[56px] lg:max-w-[72px]"
				style={{ height: `${height}px` }}
			/>
		);
	}

	return (
		<span
			key={animationKey}
			aria-hidden="true"
			className="flex w-full max-w-[44px] origin-bottom flex-col-reverse overflow-hidden rounded-t-[1px] bg-soft-hairline sm:max-w-[56px] lg:max-w-[72px]"
			style={{ height: `${height}px` }}
		>
			{visibleSegments.map((segment, index) => (
				<span
					key={segment.key}
					className="min-h-0"
					style={{
						flexGrow: segment.value,
						minHeight: visibleSegments.length > 1 ? "2px" : undefined,
						backgroundColor: segment.color,
						boxShadow: index > 0 ? "inset 0 -1px 0 var(--color-warm-paper-raised)" : undefined,
					}}
				/>
			))}
		</span>
	);
}

function Legend(): React.JSX.Element {
	return (
		<ul aria-label="Bar segments" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
			{LEGEND_SEGMENTS.map(segment => (
				<li key={segment.key} className="inline-flex items-center gap-2">
					<span
						aria-hidden="true"
						className="block h-2 w-2 rounded-[1px]"
						style={{ backgroundColor: segment.color }}
					/>
					<span className="font-mono text-xs text-faded-sumi">
						{segment.label}
					</span>
				</li>
			))}
		</ul>
	);
}

// ── Copy ─────────────────────────────────────────────────────────────────────

function EmptyForecast(): React.JSX.Element {
	// No top divider here — SectionCard's CardHeader already draws the hairline
	// rule directly above this content.
	return (
		<div className="mt-4 flex flex-col items-start gap-y-2">
			<p className="font-mono text-xs text-faded-sumi">
				Quiet week
			</p>
			<p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
				Nothing is scheduled for the next seven days. Cards return when they are close to fading.
			</p>
		</div>
	);
}

function GlossaryToggle({
	open,
	onToggle,
}: {
	open: boolean;
	onToggle: () => void;
}): React.JSX.Element {
	return (
		<QuietLink
			onClick={onToggle}
			aria-expanded={open}
			aria-controls="week-rhythm-glossary"
		>
			{open ? "Hide definitions" : "What do these mean?"}
		</QuietLink>
	);
}

function Glossary(): React.JSX.Element {
	return (
		<dl
			id="week-rhythm-glossary"
			className="mt-4 grid gap-x-6 gap-y-3 border-t border-soft-hairline pt-4 sm:grid-cols-3"
		>
			<div>
				<dt
					className="font-mono text-xs"
					style={{ color: "var(--color-queue-new-mark)" }}
				>
					New
				</dt>
				<dd className="mt-1 text-sm leading-relaxed text-faded-sumi">
					Not yet reviewed. The first rating starts their schedule.
				</dd>
			</div>
			<div>
				<dt
					className="font-mono text-xs"
					style={{ color: "var(--color-queue-review-mark)" }}
				>
					Due
				</dt>
				<dd className="mt-1 text-sm leading-relaxed text-faded-sumi">
					Scheduled for today. Recall, then rate honestly.
				</dd>
			</div>
			<div>
				<dt
					className="font-mono text-xs"
					style={{ color: "var(--color-queue-backlog-mark)" }}
				>
					Overdue
				</dt>
				<dd className="mt-1 text-sm leading-relaxed text-faded-sumi">
					Past due. The next interval will tighten.
				</dd>
			</div>
		</dl>
	);
}

// ── Scale helpers ─────────────────────────────────────────────────────────────

function peakCountForDays(days: ReadonlyArray<RhythmDay>): number {
	let peak = 0;
	for (const day of days) {
		if (day.total > peak)
			peak = day.total;
	}
	return peak;
}

function roundUpToNice(value: number): number {
	if (value <= 0)
		return 1;
	if (value <= 5)
		return 5;
	if (value <= 10)
		return 10;
	if (value <= 20)
		return 20;
	if (value <= 50)
		return 50;
	if (value <= 100)
		return 100;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	return Math.ceil(value / magnitude) * magnitude;
}
