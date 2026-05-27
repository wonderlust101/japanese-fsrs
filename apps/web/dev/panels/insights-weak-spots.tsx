"use client";

import type { ApiWeakSpotListResponse } from "@fsrs-japanese/shared-types";

import type { DevFixtureSpec } from "@/dev";
import { useMemo } from "react";

import {
	buildCleanFixture,
	buildFewFixture,
	buildManyFixture,
	buildOrphanFixture,
	buildResolvedFixture,
} from "@/app/(app)/weak-spots/_components/weakSpotsFixtures";
import { useDevStatePanel } from "@/dev";

export type LeechesFixtureKey
	= | "off"
		| "clean"
		| "few"
		| "many"
		| "resolved"
		| "orphan"
		| "loading"
		| "error";

export interface LeechesDevState {
	fixtureData: ApiWeakSpotListResponse | null;
	forcedState: "loading" | "error" | null;
}

const FIXTURES: ReadonlyArray<DevFixtureSpec<LeechesFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real weak-spot list." },
	{ key: "clean", label: "Clean", description: "No weak spots in the current window; empty state." },
	{ key: "few", label: "A few", description: "Three weak spots across two decks." },
	{ key: "many", label: "Many", description: "Seven weak spots with mixed modalities and diagnoses." },
	{ key: "resolved", label: "Resolved", description: "Resolved-status fixture — Reopen affordance visible." },
	{ key: "orphan", label: "Orphan", description: "Cards deleted post-detection; minimal row anatomy." },
	{ key: "loading", label: "Loading", description: "Show the skeleton list." },
	{ key: "error", label: "Error", description: "Show the inline error alert." },
];

export function useLeechesDevState(): LeechesDevState {
	const { fixture } = useDevStatePanel({
		id: "insights.weak-spots",
		title: "Insights · Weak spots",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const fixtureData = useMemo<ApiWeakSpotListResponse | null>(() => {
		if (fixture === "clean")
			return buildCleanFixture();
		if (fixture === "few")
			return buildFewFixture();
		if (fixture === "many")
			return buildManyFixture();
		if (fixture === "resolved")
			return buildResolvedFixture();
		if (fixture === "orphan")
			return buildOrphanFixture();
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
