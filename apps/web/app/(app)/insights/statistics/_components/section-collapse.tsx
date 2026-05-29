"use client";

import type { StatisticsSectionId } from "./sections";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

/**
 * Shared collapse state for the Statistics page's sections. The page is the
 * deep-dive surface (the Insights overview is the glance), so every section
 * starts expanded; a returning learner's collapses are remembered in
 * localStorage. The sticky section-nav also consumes this so navigating to a
 * collapsed section expands it before scrolling.
 */
interface SectionCollapseValue {
	isCollapsed: (id: StatisticsSectionId) => boolean;
	toggle: (id: StatisticsSectionId) => void;
	expand: (id: StatisticsSectionId) => void;
}

const SectionCollapseContext = createContext<SectionCollapseValue | null>(null);

const STORAGE_KEY = "tomo.statistics.collapsedSections";

function readPersisted(): Record<string, boolean> {
	if (typeof window === "undefined")
		return {};
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw === null)
			return {};
		const parsed: unknown = JSON.parse(raw);
		if (parsed === null || typeof parsed !== "object")
			return {};
		return parsed as Record<string, boolean>;
	} catch {
		return {};
	}
}

export function SectionCollapseProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	// Start all-expanded so server and first client paint agree (no hydration
	// mismatch); hydrate the persisted collapses after mount.
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

	useEffect(() => {
		setCollapsed(readPersisted()); // eslint-disable-line react/set-state-in-effect -- hydrates persisted collapse state after mount; starts all-expanded to match SSR
	}, []);

	const persist = useCallback((next: Record<string, boolean>): void => {
		setCollapsed(next);
		if (typeof window === "undefined")
			return;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Storage unavailable (private mode, quota); in-memory state still works.
		}
	}, []);

	const value = useMemo<SectionCollapseValue>(() => ({
		isCollapsed: id => collapsed[id] === true,
		toggle: id => persist({ ...collapsed, [id]: !(collapsed[id] === true) }),
		expand: (id) => {
			if (collapsed[id] !== true)
				return;
			persist({ ...collapsed, [id]: false });
		},
	}), [collapsed, persist]);

	return (
		<SectionCollapseContext value={value}>
			{children}
		</SectionCollapseContext>
	);
}

/**
 * Collapse controls for one section. Safe outside a provider (no-op collapse,
 *  always expanded) so section components stay usable in isolation/dev panels.
 */
export function useSectionCollapse(id: StatisticsSectionId): {
	collapsed: boolean;
	toggle: () => void;
} {
	const ctx = use(SectionCollapseContext);
	if (ctx === null)
		return { collapsed: false, toggle: () => {} };
	return { collapsed: ctx.isCollapsed(id), toggle: () => ctx.toggle(id) };
}

/** Imperative expand, used by the section-nav before it scrolls to a target. */
export function useExpandSection(): (id: StatisticsSectionId) => void {
	const ctx = use(SectionCollapseContext);
	return ctx?.expand ?? (() => {});
}
