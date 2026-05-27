"use client";

import type { StatisticsData } from "@/app/(app)/insights/statistics/_components/types";

import type { DevFixtureSpec } from "@/dev";

import { useMemo } from "react";
import {
	buildFullFixture,
	buildHeavyBacklogFixture,
	buildLimitedFixture,
} from "@/app/(app)/insights/statistics/_components/fixtures";
import { useDevStatePanel } from "@/dev";

export type StatisticsFixtureKey
	= | "off"
		| "full"
		| "limited"
		| "heavy-backlog"
		| "loading"
		| "error";

export interface StatisticsDevState {
	fixtureData: StatisticsData | null;
	forcedState: "loading" | "error" | null;
}

const FIXTURES: ReadonlyArray<DevFixtureSpec<StatisticsFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real statistics." },
	{ key: "full", label: "Full data", description: "Mid-progress N3 learner, 365 days of activity." },
	{ key: "limited", label: "Limited data", description: "New user, 2 weeks of activity." },
	{ key: "heavy-backlog", label: "Heavy backlog", description: "84 overdue cards." },
	{ key: "loading", label: "Loading", description: "Show full-page skeletons." },
	{ key: "error", label: "Error", description: "Show inline error alert." },
];

export function useStatisticsDevState(): StatisticsDevState {
	const { fixture } = useDevStatePanel({
		id: "insights.statistics",
		title: "Insights · Statistics",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const fixtureData = useMemo<StatisticsData | null>(() => {
		if (fixture === "full")
			return buildFullFixture();
		if (fixture === "limited")
			return buildLimitedFixture();
		if (fixture === "heavy-backlog")
			return buildHeavyBacklogFixture();
		return null;
	}, [fixture]);

	const forcedState: "loading" | "error" | null
		= fixture === "loading"
			? "loading"
			: fixture === "error"
				? "error"
				: null;

	return { fixtureData, forcedState };
}
