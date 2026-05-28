"use client";

import type { DevFixtureSpec } from "@/dev/DevDockContext";
import { useDevStatePanel } from "@/dev/useDevStatePanel";

export type ForecastFixtureKey
	= | "off"
		| "loading"
		| "error";

const FIXTURES: ReadonlyArray<DevFixtureSpec<ForecastFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real forecast." },
	{ key: "loading", label: "Loading", description: "Force the loading skeleton." },
	{ key: "error", label: "Error", description: "Force the inline error state." },
];

export interface ForecastDevState {
	forcedState: "loading" | "error" | null;
}

export function useForecastDevState(): ForecastDevState {
	const { fixture } = useDevStatePanel({
		id: "insights.forecast",
		title: "Insights · Forecast",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const forcedState
		= fixture === "loading"
			? "loading"
			: fixture === "error"
				? "error"
				: null;

	return { forcedState };
}
