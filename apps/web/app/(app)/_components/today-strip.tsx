"use client";

import { useEffect, useState } from "react";

const JA_WEEKDAYS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"] as const;
const JA_WEEKDAY_SHORT = ["日", "月", "火", "水", "木", "金", "土"] as const;
const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const EN_WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

interface DateParts {
	month: number;
	day: number;
	weekdayIndex: number;
}

function getTodayParts(): DateParts {
	const now = new Date();
	return { month: now.getMonth() + 1, day: now.getDate(), weekdayIndex: now.getDay() };
}

/**
 * Bilingual today strip pinned to 60px height. Per-element kanji tooltips
 * turn the chrome into a pedagogical surface for learners: hover any
 * Japanese character to see its meaning. The Latin line stays as a
 * glanceable fallback.
 *
 * SSR-safe: seeds the initial render with the server's clock, then
 * rehydrates on mount so the displayed date matches the user's local
 * timezone instead of UTC. (Without rehydration, a user in JST would
 * potentially see yesterday's date.)
 */
export function TodayStripExpanded(): React.JSX.Element {
	const [parts, setParts] = useState<DateParts>(getTodayParts);
	useEffect(() => {
		setParts(getTodayParts());
	}, []);

	const jaWeekday = JA_WEEKDAYS[parts.weekdayIndex] ?? "月曜日";
	const enWeekday = EN_WEEKDAYS[parts.weekdayIndex] ?? "Monday";
	const enMonth = EN_MONTHS[parts.month - 1] ?? "May";

	return (
		<div className="h-[60px] px-4 pb-3 pt-2 border-b border-soft-hairline shrink-0 relative z-[1] bg-warm-paper-raised">
			<div className="flex items-baseline gap-x-2">
				<span lang="ja" className="font-mono text-sm tabular-nums text-sumi-ink">
					{parts.month}
					<span title="month">月</span>
					{parts.day}
					<span title="day">日</span>
				</span>
				<span aria-hidden="true" className="text-faded-sumi/45">·</span>
				<span lang="ja" title={enWeekday} className="font-display text-xs leading-none text-inari-vermillion/75">
					{jaWeekday}
				</span>
			</div>
			<div className="mt-0.5 font-mono text-sm tabular-nums text-faded-sumi/85 leading-tight">
				{enMonth}
				{" "}
				{parts.day}
				{" "}
				·
				{" "}
				{enWeekday}
			</div>
		</div>
	);
}

/**
 * Compact 3-line stack used in the 64px collapsed rail. Same h-[60px] as
 * the expanded variant so the DOM swap doesn't shift everything below.
 * justify-center vertically centers the smaller content within the locked
 * height.
 */
export function TodayStripCollapsed(): React.JSX.Element {
	const [parts, setParts] = useState<DateParts>(getTodayParts);
	useEffect(() => {
		setParts(getTodayParts());
	}, []);

	const jaWeekdayShort = JA_WEEKDAY_SHORT[parts.weekdayIndex] ?? "月";
	const enWeekdayShort = EN_WEEKDAYS_SHORT[parts.weekdayIndex] ?? "Mon";
	const enWeekday = EN_WEEKDAYS[parts.weekdayIndex] ?? "Monday";

	return (
		<div className="h-[60px] px-1 pb-2 pt-2 border-b border-soft-hairline shrink-0 relative z-[1] bg-warm-paper-raised flex flex-col items-center justify-center gap-1">
			<span lang="ja" className="font-mono text-sm tabular-nums text-sumi-ink leading-none">
				{parts.month}
				<span title="month">月</span>
				{parts.day}
				<span title="day">日</span>
			</span>
			<span lang="ja" title={enWeekday} className="font-display text-sm leading-none text-inari-vermillion/75">
				{jaWeekdayShort}
			</span>
			<span className="font-mono text-sm tabular-nums text-faded-sumi/85 leading-none">
				{enWeekdayShort}
			</span>
		</div>
	);
}
