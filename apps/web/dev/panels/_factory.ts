"use client";

import type { DevFixtureSpec } from "@/dev";
import { useDevStatePanel } from "@/dev";

// ── Shared lifecycle vocabulary ──────────────────────────────────────────────
//
// Most page-level dev panels follow the same shape: a fixture radio that
// forces a render branch (off / loading / error / empty / submitting /
// success). Rather than duplicate the vocabulary across 20+ files, the
// factory below builds a hook from `{ id, title, states }` and returns a
// `forced: <state> | null` value the page can read. The page is still
// responsible for applying the forced branch to its own render — the factory
// only owns panel registration, fixture persistence, and the state-to-label
// mapping the dock shows.

export type LifecycleState
	= | "loading"
		| "error"
		| "empty"
		| "submitting"
		| "success";

interface StateSpec {
	key: LifecycleState;
	label: string;
	description: string;
}

const STATE_SPECS: Record<LifecycleState, StateSpec> = {
	loading: { key: "loading", label: "Loading", description: "Force the loading / skeleton branch." },
	error: { key: "error", label: "Error", description: "Force the inline error branch." },
	empty: { key: "empty", label: "Empty", description: "Force the empty-state branch." },
	submitting: { key: "submitting", label: "Submitting", description: "Force the in-flight submit / saving branch." },
	success: { key: "success", label: "Success", description: "Force the post-submit success branch." },
};

const OFF_FIXTURE: DevFixtureSpec<"off"> = {
	key: "off",
	label: "Off",
	description: "Live data — let the page render its real branch.",
};

export interface LifecyclePanelOptions {
	/** Stable panel id, e.g. `decks.premade`. Becomes the localStorage key. */
	id: string;
	/** Dock section header, e.g. `Decks · Premade`. */
	title: string;
	/** Which states the page exposes. Order is preserved in the radio list. */
	states: ReadonlyArray<LifecycleState>;
}

export interface LifecyclePanelResult {
	/** The active forced state, or `null` when the panel is "off". */
	forced: LifecycleState | null;
	/** Convenience: true whenever any non-default fixture is active. */
	isActive: boolean;
}

/**
 * Build a per-page lifecycle dev panel. The returned hook registers with the
 * dock on mount, persists its fixture choice across reloads, and exposes the
 * current forced state to the caller.
 *
 * In production the underlying `useDevStatePanel` is a no-op (the provider
 * returns a stub context outside development), so the hook is safe to call
 * unconditionally from any client component.
 */
export function createLifecyclePanel(opts: LifecyclePanelOptions): () => LifecyclePanelResult {
	const fixtures: ReadonlyArray<DevFixtureSpec<"off" | LifecycleState>> = [
		OFF_FIXTURE,
		...opts.states.map(state => STATE_SPECS[state]),
	];

	return function useLifecyclePanel(): LifecyclePanelResult {
		const { fixture } = useDevStatePanel<"off" | LifecycleState>({
			id: opts.id,
			title: opts.title,
			fixtures,
			defaultFixture: "off",
		});

		return {
			forced: fixture === "off" ? null : fixture,
			isActive: fixture !== "off",
		};
	};
}
