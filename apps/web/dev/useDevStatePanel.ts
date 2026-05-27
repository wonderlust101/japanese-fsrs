"use client";

import type { ReactNode } from "react";
import type { DevFixtureSpec, DevPanelRegistration } from "./DevDockContext";

import { useCallback, useEffect, useState } from "react";
import {
	useDevDockContext,

} from "./DevDockContext";

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_PREFIX = "tomo:dev:panel:";

function readStoredFixture(id: string): string | null {
	if (typeof window === "undefined")
		return null;
	try {
		return window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
	} catch {
		return null;
	}
}

function writeStoredFixture(id: string, value: string): void {
	if (typeof window === "undefined")
		return;
	try {
		window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, value);
	} catch {
		// ignore
	}
}

// ── Fixtures-mode hook ───────────────────────────────────────────────────────

export interface UseDevStatePanelOptions<T extends string> {
	/** Stable, unique panel id, e.g. `today.hero`. Used as the localStorage key. */
	id: string;
	/** Header label shown in the dock section. e.g. `Today · Hero`. */
	title: string;
	/** Fixture options. The first entry's `key` is the default when none is set. */
	fixtures: ReadonlyArray<DevFixtureSpec<T>>;
	/** Optional explicit default. Falls back to `fixtures[0].key`. */
	defaultFixture?: T;
	/** Optional footer node rendered below the radio list. */
	footer?: ReactNode;
}

export interface UseDevStatePanelResult<T extends string> {
	fixture: T;
	setFixture: (next: T) => void;
	/** True when the active fixture is anything other than the default ("off"-style). */
	isActive: boolean;
}

/**
 * Register a fixture-radio dev panel with the global DevDock.
 *
 * Each page calls this once per state group it wants to expose. The dock
 * renders the radio list under a collapsible section labeled `title`. The
 * page reads `fixture` to drive its render branch and ignores `setFixture` —
 * the dock UI calls it from its click handlers.
 *
 * Outside development the hook still runs (so the page's hook order stays
 * stable across builds) but every operation is a no-op: the context returned
 * by `useDevDockContext()` is the prod no-op stub when no provider is in
 * scope, registration writes nothing, and `fixture` stays at the default. The
 * page therefore renders the live-data branch in production without any
 * conditional plumbing.
 */
export function useDevStatePanel<T extends string>({
	id,
	title,
	fixtures,
	defaultFixture,
	footer,
}: UseDevStatePanelOptions<T>): UseDevStatePanelResult<T> {
	// Destructure register/unregister rather than the whole context. Each is
	// a `useCallback`-stable function reference, so they don't change across
	// renders. The full `ctx` object DOES change every time `panels` updates
	// (it's in the provider's `useMemo` deps), which means depending on
	// `ctx` in the effect below would re-run the effect after every register
	// call — and that triggers another register, infinitely. Reading the
	// stable callbacks here breaks that feedback loop.
	const { register, unregister } = useDevDockContext();

	const initial = (): T => {
		const stored = readStoredFixture(id);
		if (stored !== null && fixtures.some(f => f.key === stored))
			return stored as T;
		if (defaultFixture !== undefined)
			return defaultFixture;
		const first = fixtures[0];
		return (first !== undefined ? first.key : "") as T;
	};

	const [fixture, setFixtureState] = useState<T>(initial);

	const setFixture = useCallback((next: T): void => {
		setFixtureState(next);
		writeStoredFixture(id, next);
	}, [id]);

	// Register / re-register on every relevant change so the dock always
	// reflects the current fixture. Unregister on unmount keeps the dock from
	// showing stale panels after route changes.
	useEffect(() => {
		const active = fixtures.find(f => f.key === fixture);
		const registration: DevPanelRegistration = {
			id,
			title,
			mode: "fixtures",
			fixtures,
			fixture,
			setFixture: (next: string) => setFixture(next as T),
			activeLabel: active !== undefined ? active.label : "Default",
			...(footer !== undefined ? { footer } : {}),
		};
		register({ registration });
		return () => unregister(id);
	}, [register, unregister, id, title, fixtures, fixture, setFixture, footer]);

	const defaultKey = defaultFixture ?? (fixtures[0] !== undefined ? fixtures[0].key : "");
	return {
		fixture,
		setFixture,
		isActive: fixture !== defaultKey,
	};
}

// ── Render-mode hook ─────────────────────────────────────────────────────────

export interface UseDevPanelOptions {
	/** Stable, unique panel id. */
	id: string;
	/** Section header label. */
	title: string;
	/** Body renderer. The dock calls this each render to produce the section content. */
	render: () => ReactNode;
	/** Optional short summary shown next to the title (e.g. the active state name). */
	activeLabel?: string;
	/** Optional footer node rendered below the body. */
	footer?: ReactNode;
}

/**
 * Register a custom-render dev panel with the global DevDock. The page owns
 * the panel's state entirely; the dock provides only the section chrome
 * (title, collapse, footer). Use this when the body is richer than a flat
 * fixture radio list — for example, the today hero controls (multiple
 * selects) or the review session toolbar (mixed buttons, checkboxes, links).
 */
export function useDevPanel({
	id,
	title,
	render,
	activeLabel,
	footer,
}: UseDevPanelOptions): void {
	// Same destructuring rationale as `useDevStatePanel`: read the stable
	// `register` / `unregister` callbacks rather than the whole `ctx` object,
	// which re-references on every `panels` change and would otherwise drive
	// an infinite register-rerender-register loop.
	const { register, unregister } = useDevDockContext();

	useEffect(() => {
		const registration: DevPanelRegistration = {
			id,
			title,
			mode: "render",
			render,
			...(activeLabel !== undefined ? { activeLabel } : {}),
			...(footer !== undefined ? { footer } : {}),
		};
		register({ registration });
		return () => unregister(id);
	}, [register, unregister, id, title, render, activeLabel, footer]);
}
