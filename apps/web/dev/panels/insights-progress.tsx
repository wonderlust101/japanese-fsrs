"use client";

import type { ProgressData } from "@/app/(app)/insights/progress/_components/progress-types";

import type { DevFixtureSpec } from "@/dev/DevDockContext";

import { useMemo } from "react";
import {
	buildDecliningFixture,
	buildLimitedFixture,
	buildPlateauFixture,
	buildStrongFixture,
} from "@/app/(app)/insights/progress/_components/progress-fixtures";
import { useDevStatePanel } from "@/dev/useDevStatePanel";

export type ProgressFixtureKey
	= | "off"
		| "strong"
		| "plateau"
		| "declining"
		| "limited"
		| "loading"
		| "error";

export interface ProgressDevState {
	fixtureData: ProgressData | null;
	forcedState: "loading" | "error" | null;
}

const FIXTURES: ReadonlyArray<DevFixtureSpec<ProgressFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real progress view." },
	{ key: "strong", label: "Strong", description: "Memory holding, mature pile growing on schedule." },
	{ key: "plateau", label: "Plateau", description: "Retention steady, mature growth flat for 30d." },
	{ key: "declining", label: "Declining", description: "Retention dropped 4–8 points over the past 3 weeks." },
	{ key: "limited", label: "Limited", description: "Under 14 days of history — empty state." },
	{ key: "loading", label: "Loading", description: "Show full-page skeletons." },
	{ key: "error", label: "Error", description: "Show inline error alert." },
];

export function useProgressDevState(): ProgressDevState {
	const { fixture } = useDevStatePanel({
		id: "insights.progress",
		title: "Insights · Progress",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const fixtureData = useMemo<ProgressData | null>(() => {
		// Build-time gate (positive `if` block) so webpack prunes the builder refs
		// and progress-fixtures.ts tree-shakes out of the prod /insights/progress chunk.
		if (process.env.NODE_ENV === "development") {
			if (fixture === "strong")
				return buildStrongFixture();
			if (fixture === "plateau")
				return buildPlateauFixture();
			if (fixture === "declining")
				return buildDecliningFixture();
			if (fixture === "limited")
				return buildLimitedFixture();
		}
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
