"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { useArchiveDeck, useDecks, useUnarchiveDeck } from "@/lib/api/decks";

/**
 * Per-user, per-device persistence for Library page state that has no backend
 * representation yet: view preferences (sort, type filter, archive toggle),
 * the study order (an ordered list of deck IDs whose slot 01 is the priority
 * deck), and the archived-deck set.
 *
 * Backend wiring is a separate task. Until then, this hook lets the redesign
 * feel real end-to-end (drag-reorder, pin priority, archive, restore all
 * stick across page reloads on the same device).
 */

// Zod enums are the single source of truth for these closed sets so the
// localStorage migration (`migratePrefs`) can validate membership instead of
// blindly casting a persisted string to the union — a stale or hand-edited
// value then falls back to the default rather than flowing downstream typed
// but structurally invalid.
const decksSortKeySchema = z.enum([
	"study-order",
	"recently-reviewed",
	"alphabetical",
	"most-due-first",
	"jlpt-level",
]);
const decksTypeFilterSchema = z.enum(["all", "vocabulary", "kanji", "mixed"]);
/** Top-level tab on the Decks page. */
const decksViewTabSchema = z.enum(["active", "mature", "archived"]);

export type DecksSortKey = z.infer<typeof decksSortKeySchema>;
export type DecksTypeFilter = z.infer<typeof decksTypeFilterSchema>;
export type DecksViewTab = z.infer<typeof decksViewTabSchema>;

export interface DeckViewPrefs {
	sort: DecksSortKey;
	typeFilter: DecksTypeFilter;
	/** Top-level tab. Replaces the older showArchived boolean. */
	view: DecksViewTab;
}

const VIEW_PREFS_KEY = "tomo.decks.viewPrefs.v1";
const STUDY_ORDER_KEY = "tomo.decks.studyOrder.v1";
const ARCHIVED_KEY = "tomo.decks.archived.v1";
// Sentinel flipped to true after the one-shot localStorage→server archive
// migration has run on this browser. The presence of the flag short-circuits
// the migration on every subsequent mount.
const ARCHIVED_KEY_MIGRATED = "tomo.decks.archived.v1.migrated";
const RESERVED_LOCAL_NAME_KEY = "tomo.decks.localNameOverrides.v1";

const DEFAULT_PREFS: DeckViewPrefs = {
	sort: "study-order",
	typeFilter: "all",
	view: "active",
};

/**
 * Migrate legacy persisted prefs that still carry `showArchived` (boolean)
 * into the new `view` tab key. Forward-only: once a user lands on the new
 * shape, this branch is a no-op.
 */
function migratePrefs(raw: unknown): DeckViewPrefs {
	if (raw === null || typeof raw !== "object")
		return DEFAULT_PREFS;
	const obj = raw as Record<string, unknown>;
	// `view` (new shape) wins; fall back to the legacy `showArchived` boolean.
	// Each field is membership-validated against its enum so a stale or
	// hand-edited value falls back to the default instead of flowing downstream
	// typed-but-invalid.
	const parsedView = decksViewTabSchema.safeParse(obj.view);
	const view: DecksViewTab = parsedView.success
		? parsedView.data
		: obj.showArchived === true
			? "archived"
			: "active";
	const parsedSort = decksSortKeySchema.safeParse(obj.sort);
	const parsedTypeFilter = decksTypeFilterSchema.safeParse(obj.typeFilter);
	return {
		sort: parsedSort.success ? parsedSort.data : DEFAULT_PREFS.sort,
		typeFilter: parsedTypeFilter.success ? parsedTypeFilter.data : DEFAULT_PREFS.typeFilter,
		view,
	};
}

// Validates the persisted shape, not just JSON well-formedness: a stale entry
// from an older app version (or a hand-edited one) fails `safeParse` and falls
// back instead of flowing downstream typed as `T` but structurally wrong.
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
		// Quota / privacy mode: prefs silently fall back to in-memory only.
	}
}

export function useViewPrefs(): {
	prefs: DeckViewPrefs;
	setSort: (sort: DecksSortKey) => void;
	setTypeFilter: (filter: DecksTypeFilter) => void;
	setView: (view: DecksViewTab) => void;
} {
	const [prefs, setPrefs] = useState<DeckViewPrefs>(DEFAULT_PREFS);

	// Hydrate from localStorage after mount to avoid SSR/CSR text mismatch.
	useEffect(() => {
		// `migratePrefs` is itself the shape validator for this key (it tolerates
		// legacy `showArchived`), so the read stays permissive with `z.unknown()`.
		setPrefs(migratePrefs(safeRead(VIEW_PREFS_KEY, z.unknown(), null)));
	}, []);

	const persist = useCallback((next: DeckViewPrefs) => {
		setPrefs(next);
		safeWrite(VIEW_PREFS_KEY, next);
	}, []);

	return {
		prefs,
		setSort: sort => persist({ ...prefs, sort }),
		setTypeFilter: typeFilter => persist({ ...prefs, typeFilter }),
		setView: view => persist({ ...prefs, view }),
	};
}

/**
 * Study order is the user-curated order in which Tomo will surface decks
 * during Practice. Stored as an ordered list of deck IDs; the deck at index 0
 * is the "priority" deck (slot 01). Decks not in the array are appended at
 * the end of the queue in the order the server returns them (so newly created
 * or newly subscribed decks land at the tail without explicit positioning).
 */
export function useStudyOrder(knownDeckIds: ReadonlyArray<string>): {
	studyOrder: ReadonlyArray<string>;
	resolvedOrder: ReadonlyArray<string>;
	priorityDeckId: string | null;
	setOrder: (next: ReadonlyArray<string>) => void;
	setAsPriority: (deckId: string) => void;
	moveUp: (deckId: string) => void;
	moveDown: (deckId: string) => void;
	moveToTop: (deckIds: ReadonlyArray<string>) => void;
} {
	const [studyOrder, setStudyOrder] = useState<ReadonlyArray<string>>([]);

	useEffect(() => {
		setStudyOrder(safeRead(STUDY_ORDER_KEY, z.array(z.string()), []));
	}, []);

	// Resolved order: start from the stored order, drop any IDs no longer in
	// knownDeckIds (the deck was deleted), then append any knownDeckIds not yet
	// placed. This guarantees we have a stable, complete order for every deck.
	const resolvedOrder = useMemo<ReadonlyArray<string>>(() => {
		const known = new Set(knownDeckIds);
		const placed = studyOrder.filter(id => known.has(id));
		const placedSet = new Set(placed);
		const tail = knownDeckIds.filter(id => !placedSet.has(id));
		return [...placed, ...tail];
	}, [studyOrder, knownDeckIds]);

	const persist = useCallback((next: ReadonlyArray<string>) => {
		setStudyOrder(next);
		safeWrite(STUDY_ORDER_KEY, next);
	}, []);

	return {
		studyOrder,
		resolvedOrder,
		priorityDeckId: resolvedOrder[0] ?? null,
		setOrder: next => persist(next),
		setAsPriority: (deckId) => {
			const without = resolvedOrder.filter(id => id !== deckId);
			persist([deckId, ...without]);
		},
		moveUp: (deckId) => {
			const i = resolvedOrder.indexOf(deckId);
			if (i <= 0)
				return;
			const next = [...resolvedOrder];
			const above = next[i - 1];
			const current = next[i];
			if (above === undefined || current === undefined)
				return;
			next[i - 1] = current;
			next[i] = above;
			persist(next);
		},
		moveDown: (deckId) => {
			const i = resolvedOrder.indexOf(deckId);
			if (i < 0 || i >= resolvedOrder.length - 1)
				return;
			const next = [...resolvedOrder];
			const below = next[i + 1];
			const current = next[i];
			if (below === undefined || current === undefined)
				return;
			next[i + 1] = current;
			next[i] = below;
			persist(next);
		},
		moveToTop: (deckIds) => {
			const ids = new Set(deckIds);
			// Preserve the inter-selection order from the current resolved order.
			const selectedInOrder = resolvedOrder.filter(id => ids.has(id));
			const rest = resolvedOrder.filter(id => !ids.has(id));
			persist([...selectedInOrder, ...rest]);
		},
	};
}

/**
 * Archive set, backed by `decks.archived_at` since migration
 * 20260622000000_deck_archive.sql. The canonical archived set is derived
 * from `useDecks(50, 'all')`, the mutate verbs forward to the API hooks,
 * and TanStack Query's invalidation keeps the list in sync after a write
 * (no local mirror to drift).
 *
 * One-shot localStorage migration: on the first authenticated mount after
 * this PR ships, any deck IDs still in the legacy `tomo.decks.archived.v1`
 * LS key are POSTed to `/decks/:id/archive` (idempotent on the server) and
 * the key is cleared. The migration runs once per browser by guarding on a
 * ref + a sentinel LS key (`ARCHIVED_KEY_MIGRATED`). Errors are swallowed —
 * worst case the user re-archives a deck they expected to find shelved.
 */
export function useArchiveSet(): {
	archivedIds: ReadonlySet<string>;
	isArchived: (deckId: string) => boolean;
	archive: (deckId: string) => void;
	restore: (deckId: string) => void;
	archiveMany: (deckIds: ReadonlyArray<string>) => void;
} {
	// `view: 'all'` so this query covers both active + archived rows; TanStack
	// Query dedupes between consumers sharing the same key, so multiple
	// `useArchiveSet` callers on the same page share one fetch.
	const decksQuery = useDecks(50, "all");
	const archiveMut = useArchiveDeck();
	const unarchiveMut = useUnarchiveDeck();
	const migrationFired = useRef(false);

	const archivedIds = useMemo<ReadonlySet<string>>(() => {
		const items = decksQuery.data?.items ?? [];
		const set = new Set<string>();
		for (const d of items) {
			if (d.archivedAt !== null)
				set.add(d.id);
		}
		return set;
	}, [decksQuery.data]);

	// One-shot LS → server migration. Runs once per browser, after the deck
	// list has resolved (so we can intersect the LS set against decks the
	// user actually owns — guards against stale IDs from deleted decks).
	useEffect(() => {
		if (migrationFired.current)
			return;
		if (typeof window === "undefined")
			return;
		if (decksQuery.data === undefined)
			return;
		if (safeRead(ARCHIVED_KEY_MIGRATED, z.boolean(), false))
			return;
		const legacy = safeRead(ARCHIVED_KEY, z.array(z.string()), []);
		if (legacy.length === 0) {
			window.localStorage.removeItem(ARCHIVED_KEY);
			safeWrite(ARCHIVED_KEY_MIGRATED, true);
			return;
		}
		migrationFired.current = true;
		const ownIds = new Set(decksQuery.data.items.map(d => d.id));
		const toArchive = legacy.filter(id => ownIds.has(id));
		void Promise.allSettled(toArchive.map(id => archiveMut.mutateAsync(id)))
			.finally(() => {
				window.localStorage.removeItem(ARCHIVED_KEY);
				safeWrite(ARCHIVED_KEY_MIGRATED, true);
			});
	}, [decksQuery.data, archiveMut]);

	return {
		archivedIds,
		isArchived: deckId => archivedIds.has(deckId),
		archive: (deckId) => { archiveMut.mutate(deckId); },
		restore: (deckId) => { unarchiveMut.mutate(deckId); },
		archiveMany: (deckIds) => {
			// Parallel fan-out matches the bulk-delete pattern in deck-list.tsx.
			// Per-id failures are surfaced via the mutation's error state on the
			// call site that needs them; the hook itself fires-and-forgets.
			void Promise.allSettled(deckIds.map(id => archiveMut.mutateAsync(id)));
		},
	};
}

/**
 * Local name overrides: if the server PATCH for rename fails or is unavailable
 * yet, the page can fall back to a local override so the user's rename still
 * appears to stick in the current device session. Keyed by deck ID.
 */
export function useLocalNameOverrides(): {
	nameFor: (deckId: string, fallback: string) => string;
	setNameOverride: (deckId: string, name: string | null) => void;
} {
	const [overrides, setOverrides] = useState<Record<string, string>>({});

	useEffect(() => {
		setOverrides(safeRead(RESERVED_LOCAL_NAME_KEY, z.record(z.string(), z.string()), {}));
	}, []);

	return {
		nameFor: (deckId, fallback) => overrides[deckId] ?? fallback,
		setNameOverride: (deckId, name) => {
			const next = { ...overrides };
			if (name === null) {
				delete next[deckId];
			} else {
				next[deckId] = name;
			}
			setOverrides(next);
			safeWrite(RESERVED_LOCAL_NAME_KEY, next);
		},
	};
}
