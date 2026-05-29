"use client";

import type {
	CardMissingField,
	CardPresentField,
	CardSortField,
	CardStatusFilter,
	PitchPattern,
} from "@fsrs-japanese/shared-types";
import type { CardQualityIssue, CardQualityIssueKind } from "./cards-quality-data";

import { useCallback, useEffect, useState } from "react";

import { z } from "zod";

/**
 * Saved views for /cards. A "view" is a named filter recipe; picking one
 * seeds the toolbar + chips. Built-in views ship hard-coded; the storage
 * shape is ready for user-defined views as a follow-up.
 *
 * The redesign promotes the old "Card Quality" panel into first-class
 * views (Missing pitch, Needs attention) so the entire
 * maintenance funnel lives under a single mental model: pick a view,
 * refine with chips.
 */

export interface SavedViewRecipe {
	search?: string;
	jlptLevel?: "N5" | "N4" | "N3" | "N2" | "N1" | "beyond" | "all";
	status?: CardStatusFilter;
	missingField?: CardMissingField;
	presentField?: CardPresentField;
	pitchPattern?: PitchPattern;
	sort?: CardSortField;
}

export type SavedViewGroup = "core" | "attention" | "maintenance";

export interface SavedView {
	id: string;
	label: string;
	description: string;
	recipe: SavedViewRecipe;
	builtin: boolean;
	group: SavedViewGroup;
	/**
	 * How the live count for this view is derived. Most maintenance views
	 * map cleanly to one missing-field kind in `useCardQualityIssuesQuery`;
	 * a few derive from the underlying list query and resolve at call time
	 * via `deriveViewCount` below.
	 */
	countSource?:
		| { kind: "quality"; issueKind: CardQualityIssueKind }
		| { kind: "qualityTotal" }
		| { kind: "none" };
}

/**
 * Curated presets that ship with the app. Order here drives display order
 * inside each group of the View dropdown.
 */
export const BUILTIN_VIEWS: ReadonlyArray<SavedView> = [
	{
		id: "all",
		label: "All cards",
		description: "Every card across every deck.",
		recipe: {},
		builtin: true,
		group: "core",
		countSource: { kind: "none" },
	},
	{
		id: "recent",
		label: "Recently added",
		description: "Newest cards first.",
		recipe: { sort: "recent" },
		builtin: true,
		group: "core",
		countSource: { kind: "none" },
	},
	{
		id: "suspended",
		label: "Suspended",
		description: "Cards paused from the review queue.",
		recipe: { status: "suspended" },
		builtin: true,
		group: "core",
		countSource: { kind: "none" },
	},
	// ── Attention: a single composite that surfaces the quality funnel.
	{
		id: "needs-attention",
		label: "Needs attention",
		description: "Cards missing a field the system would normally fill.",
		recipe: { sort: "recent" },
		builtin: true,
		group: "attention",
		countSource: { kind: "qualityTotal" },
	},
	{
		id: "low-mastery",
		label: "Low mastery",
		description: "Most lapses first.",
		recipe: { sort: "lapses" },
		builtin: true,
		group: "attention",
		countSource: { kind: "none" },
	},
	// ── Maintenance: per-quality-issue shortcuts. Counts live-bind.
	{
		id: "missing-pitch",
		label: "Missing pitch",
		description: "Cards without a pitch annotation.",
		recipe: { missingField: "pitch" },
		builtin: true,
		group: "maintenance",
		// Pitch counts aren't yet returned by the card-quality endpoint.
		countSource: { kind: "none" },
	},
	{
		id: "missing-picture",
		label: "Missing picture",
		description: "Cards without a picture field.",
		recipe: { missingField: "picture" },
		builtin: true,
		group: "maintenance",
		countSource: { kind: "quality", issueKind: "missing_picture" },
	},
	{
		id: "missing-mnemonic",
		label: "Missing mnemonic",
		description: "Cards without a memory hook.",
		recipe: { missingField: "mnemonic" },
		builtin: true,
		group: "maintenance",
		countSource: { kind: "quality", issueKind: "missing_mnemonic" },
	},
	{
		id: "missing-example",
		label: "Missing example",
		description: "Cards with no example sentence yet.",
		recipe: { missingField: "example" },
		builtin: true,
		group: "maintenance",
		countSource: { kind: "quality", issueKind: "missing_example" },
	},
];

const ACTIVE_KEY = "tomo.cards.activeView.v2";

// Validates the persisted shape, not just JSON well-formedness, so a stale or
// hand-edited entry falls back rather than flowing through typed as `T`.
function safeRead<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
	if (typeof window === "undefined")
		return fallback;
	try {
		const raw = window.localStorage.getItem(key);
		if (raw === null)
			return fallback;
		const parsed = schema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : fallback;
	} catch {
		return fallback;
	}
}

function safeWrite<T>(key: string, value: T): void {
	if (typeof window === "undefined")
		return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota / privacy mode — silently no-op; active view stays in memory.
	}
}

/** Lookup helper. Returns undefined for unknown ids (e.g. stale localStorage). */
export function findViewById(id: string | null): SavedView | undefined {
	if (id === null)
		return undefined;
	return BUILTIN_VIEWS.find(v => v.id === id);
}

/**
 * Derive the live count for a view from the available quality data.
 * Returns null when the view has no count source (e.g. "All cards") so
 * the dropdown can choose to render nothing rather than a "0".
 */
export function deriveViewCount(
	view: SavedView,
	qualityIssues: ReadonlyArray<CardQualityIssue> | undefined,
): number | null {
	const src = view.countSource;
	if (src === undefined || src.kind === "none")
		return null;
	if (qualityIssues === undefined)
		return null;

	if (src.kind === "qualityTotal") {
		return qualityIssues.reduce((sum, i) => sum + i.count, 0);
	}
	if (src.kind === "quality") {
		const row = qualityIssues.find(i => i.kind === src.issueKind);
		return row?.count ?? 0;
	}
	return null;
}

/**
 * Persisted active-view-id selection. Hook reads from localStorage on
 * mount; writes back on every change. Returns the resolved view object
 * for ergonomics.
 *
 * NOTE: The URL is the canonical source for active filters in the new
 * design, but the active-view id is also persisted here so a fresh visit
 * to /cards (no URL params) lands on the user's last-picked view.
 */
export function useSavedViewPersistence(): {
	views: ReadonlyArray<SavedView>;
	lastActiveId: string | null;
	remember: (id: string | null) => void;
} {
	const [lastActiveId, setLastActiveId] = useState<string | null>(null);

	useEffect(() => {
		setLastActiveId(safeRead(ACTIVE_KEY, z.string().nullable(), null)); // eslint-disable-line react/set-state-in-effect -- localStorage hydration on mount; cannot run during SSR render
	}, []);

	const remember = useCallback((next: string | null) => {
		setLastActiveId(next);
		safeWrite(ACTIVE_KEY, next);
	}, []);

	return { views: BUILTIN_VIEWS, lastActiveId, remember };
}
