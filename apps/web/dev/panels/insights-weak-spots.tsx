"use client";

import type { ApiWeakSpotListResponse } from "@fsrs-japanese/shared-types";

import type { DevFixtureSpec } from "@/dev/DevDockContext";
import { useMemo } from "react";

import {
	buildCleanFixture,
	buildFewFixture,
	buildManyFixture,
	buildOrphanFixture,
	buildResolvedFixture,
} from "@/app/(app)/weak-spots/_components/weakSpotsFixtures";
import { useDevStatePanel } from "@/dev/useDevStatePanel";

export type WeakSpotsFixtureKey
	= | "off"
		| "clean"
		| "few"
		| "many"
		| "resolved"
		| "orphan"
		| "loading"
		| "error";

export interface WeakSpotsDevState {
	fixtureData: ApiWeakSpotListResponse | null;
	forcedState: "loading" | "error" | null;
}

const FIXTURES: ReadonlyArray<DevFixtureSpec<WeakSpotsFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real weak-spot list." },
	{ key: "clean", label: "Clean", description: "No weak spots in the current window; empty state." },
	{ key: "few", label: "A few", description: "Three weak spots across two decks." },
	{ key: "many", label: "Many", description: "Seven weak spots with mixed modalities and diagnoses." },
	{ key: "resolved", label: "Resolved", description: "Resolved-status fixture — Reopen affordance visible." },
	{ key: "orphan", label: "Orphan", description: "Cards deleted post-detection; minimal row anatomy." },
	{ key: "loading", label: "Loading", description: "Show the skeleton list." },
	{ key: "error", label: "Error", description: "Show the inline error alert." },
];

export function useWeakSpotsDevState(): WeakSpotsDevState {
	const { fixture } = useDevStatePanel({
		id: "insights.weak-spots",
		title: "Insights · Weak spots",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const fixtureData = useMemo<ApiWeakSpotListResponse | null>(() => {
		// Build-time gate (positive `if` block) so webpack prunes the builder refs
		// and weakSpotsFixtures.ts tree-shakes out of the prod /weak-spots chunk.
		if (process.env.NODE_ENV === "development") {
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
