"use client";

import type { FixturePattern } from "@/app/(app)/review/summary/_components/summary-fixtures";
import Link from "next/link";

import { useCallback } from "react";
import {
	SUMMARY_FIXTURE_KEYS,
	summaryFixtureLabel,

} from "@/app/(app)/review/summary/_components/summary-fixtures";

import { useDevPanel } from "@/dev/useDevStatePanel";

import { cn } from "@/lib/utils";

interface ReviewSummaryDevStateOptions {
	/** The currently active fixture (from `?fixture=` URL param), or null. */
	active: FixturePattern | null;
}

/**
 * Register the Review Summary dev panel. The body renders a grid of fixture
 * links; each click navigates to `/review/summary?fixture=<key>`, which the
 * Summary page reads and renders against the matching synthetic payload.
 *
 * The `active` arg is forwarded so the panel highlights the live selection.
 */
export function useReviewSummaryDevState({ active }: ReviewSummaryDevStateOptions): void {
	const render = useCallback(() => {
		// Build-time gate in POSITIVE block form: webpack's ConstPlugin prunes the
		// fixture refs so summary-fixtures tree-shakes out of prod (an early-return
		// guard does NOT — webpack counts the refs as live before folding).
		if (process.env.NODE_ENV === "development") {
			return (
				<div className="grid grid-cols-2 gap-1.5">
					{SUMMARY_FIXTURE_KEYS.map((key) => {
						const isActive = active === key;
						return (
							<Link
								key={key}
								href={`/review/summary?fixture=${key}`}
								className={cn(
									"rounded-[2px] px-2 py-1.5 text-[0.65rem] text-center cursor-pointer",
									"transition-colors duration-150 ease-out",
									isActive
										? "bg-warm-paper-raised/25 text-warm-paper-raised border border-warm-paper-raised/40"
										: "border border-warm-paper-raised/15 bg-warm-paper-raised/8 text-warm-paper-raised/80 hover:bg-warm-paper-raised/15 hover:text-warm-paper-raised",
								)}
							>
								{summaryFixtureLabel(key)}
							</Link>
						);
					})}
					<Link
						href="/review/summary"
						className="col-span-2 rounded-[2px] border border-warm-paper-raised/15 px-2 py-1.5 text-[0.625rem] text-center text-warm-paper-raised/55 hover:text-warm-paper-raised hover:bg-warm-paper-raised/5 cursor-pointer transition-colors duration-150 ease-out"
						title="Clear fixture"
					>
						Clear · live data
					</Link>
				</div>
			);
		}
		return null;
	}, [active]);

	useDevPanel({
		id: "review.summary",
		title: "Review · Summary",
		render,
		activeLabel: process.env.NODE_ENV === "development" && active !== null ? summaryFixtureLabel(active) : "Live",
	});
}
