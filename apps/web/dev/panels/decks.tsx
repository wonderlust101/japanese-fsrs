"use client";

import type { DevFixtureSpec } from "@/dev";
import { useDevStatePanel } from "@/dev";

export type DecksFixtureKey
	= | "off"
		| "empty"
		| "loading"
		| "error";

const FIXTURES: ReadonlyArray<DevFixtureSpec<DecksFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real deck list." },
	{ key: "empty", label: "Empty", description: "Force the empty-state shell (no decks)." },
	{ key: "loading", label: "Loading", description: "Force deck-card skeletons." },
	{ key: "error", label: "Error", description: "Force the inline error state." },
];

export interface DecksDevState {
	forcedState: "loading" | "error" | "empty" | null;
}

/**
 * Decks list dev state. Forces loading/error/empty rendering paths so each
 * branch is reachable without manipulating the API or wiping the DB.
 */
export function useDecksDevState(): DecksDevState {
	const { fixture } = useDevStatePanel({
		id: "decks.list",
		title: "Decks · List",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const forcedState
		= fixture === "loading"
			? "loading"
			: fixture === "error"
				? "error"
				: fixture === "empty"
					? "empty"
					: null;

	return { forcedState };
}
