'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

export type DecksSortKey =
  | 'study-order'
  | 'recently-reviewed'
  | 'alphabetical'
  | 'most-due-first'
  | 'jlpt-level'

export type DecksTypeFilter = 'all' | 'vocabulary' | 'kanji' | 'mixed'

/** Top-level tab on the Decks page. */
export type DecksViewTab = 'active' | 'mature' | 'archived'

export interface DeckViewPrefs {
  sort:         DecksSortKey
  typeFilter:   DecksTypeFilter
  /** Top-level tab. Replaces the older showArchived boolean. */
  view:         DecksViewTab
}

const VIEW_PREFS_KEY      = 'tomo.decks.viewPrefs.v1'
const STUDY_ORDER_KEY     = 'tomo.decks.studyOrder.v1'
const ARCHIVED_KEY        = 'tomo.decks.archived.v1'
const RESERVED_LOCAL_NAME_KEY = 'tomo.decks.localNameOverrides.v1'

const DEFAULT_PREFS: DeckViewPrefs = {
  sort:         'study-order',
  typeFilter:   'all',
  view:         'active',
}

/**
 * Migrate legacy persisted prefs that still carry `showArchived` (boolean)
 * into the new `view` tab key. Forward-only: once a user lands on the new
 * shape, this branch is a no-op.
 */
function migratePrefs(raw: unknown): DeckViewPrefs {
  if (raw === null || typeof raw !== 'object') return DEFAULT_PREFS
  const obj = raw as Record<string, unknown>
  const view: DecksViewTab =
    typeof obj['view'] === 'string' && ['active', 'mature', 'archived'].includes(obj['view'] as string)
      ? (obj['view'] as DecksViewTab)
      : obj['showArchived'] === true
        ? 'archived'
        : 'active'
  const sort = (typeof obj['sort'] === 'string' ? obj['sort'] : DEFAULT_PREFS.sort) as DecksSortKey
  const typeFilter = (typeof obj['typeFilter'] === 'string' ? obj['typeFilter'] : DEFAULT_PREFS.typeFilter) as DecksTypeFilter
  return { sort, typeFilter, view }
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota / privacy mode: prefs silently fall back to in-memory only.
  }
}

export function useViewPrefs(): {
  prefs: DeckViewPrefs
  setSort:       (sort: DecksSortKey) => void
  setTypeFilter: (filter: DecksTypeFilter) => void
  setView:       (view: DecksViewTab) => void
} {
  const [prefs, setPrefs] = useState<DeckViewPrefs>(DEFAULT_PREFS)

  // Hydrate from localStorage after mount to avoid SSR/CSR text mismatch.
  useEffect(() => {
    setPrefs(migratePrefs(safeRead<unknown>(VIEW_PREFS_KEY, null)))
  }, [])

  const persist = useCallback((next: DeckViewPrefs) => {
    setPrefs(next)
    safeWrite(VIEW_PREFS_KEY, next)
  }, [])

  return {
    prefs,
    setSort:       (sort)       => persist({ ...prefs, sort }),
    setTypeFilter: (typeFilter) => persist({ ...prefs, typeFilter }),
    setView:       (view)       => persist({ ...prefs, view }),
  }
}

/**
 * Study order is the user-curated order in which Tomo will surface decks
 * during Practice. Stored as an ordered list of deck IDs; the deck at index 0
 * is the "priority" deck (slot 01). Decks not in the array are appended at
 * the end of the queue in the order the server returns them (so newly created
 * or newly subscribed decks land at the tail without explicit positioning).
 */
export function useStudyOrder(knownDeckIds: ReadonlyArray<string>): {
  studyOrder:       ReadonlyArray<string>
  resolvedOrder:    ReadonlyArray<string>
  priorityDeckId:   string | null
  setOrder:         (next: ReadonlyArray<string>) => void
  setAsPriority:    (deckId: string) => void
  moveUp:           (deckId: string) => void
  moveDown:         (deckId: string) => void
  moveToTop:        (deckIds: ReadonlyArray<string>) => void
} {
  const [studyOrder, setStudyOrder] = useState<ReadonlyArray<string>>([])

  useEffect(() => {
    setStudyOrder(safeRead<string[]>(STUDY_ORDER_KEY, []))
  }, [])

  // Resolved order: start from the stored order, drop any IDs no longer in
  // knownDeckIds (the deck was deleted), then append any knownDeckIds not yet
  // placed. This guarantees we have a stable, complete order for every deck.
  const resolvedOrder = useMemo<ReadonlyArray<string>>(() => {
    const known = new Set(knownDeckIds)
    const placed = studyOrder.filter((id) => known.has(id))
    const placedSet = new Set(placed)
    const tail = knownDeckIds.filter((id) => !placedSet.has(id))
    return [...placed, ...tail]
  }, [studyOrder, knownDeckIds])

  const persist = useCallback((next: ReadonlyArray<string>) => {
    setStudyOrder(next)
    safeWrite(STUDY_ORDER_KEY, next)
  }, [])

  return {
    studyOrder,
    resolvedOrder,
    priorityDeckId: resolvedOrder[0] ?? null,
    setOrder: (next) => persist(next),
    setAsPriority: (deckId) => {
      const without = resolvedOrder.filter((id) => id !== deckId)
      persist([deckId, ...without])
    },
    moveUp: (deckId) => {
      const i = resolvedOrder.indexOf(deckId)
      if (i <= 0) return
      const next = [...resolvedOrder]
      const above = next[i - 1]
      const current = next[i]
      if (above === undefined || current === undefined) return
      next[i - 1] = current
      next[i] = above
      persist(next)
    },
    moveDown: (deckId) => {
      const i = resolvedOrder.indexOf(deckId)
      if (i < 0 || i >= resolvedOrder.length - 1) return
      const next = [...resolvedOrder]
      const below = next[i + 1]
      const current = next[i]
      if (below === undefined || current === undefined) return
      next[i + 1] = current
      next[i] = below
      persist(next)
    },
    moveToTop: (deckIds) => {
      const ids = new Set(deckIds)
      // Preserve the inter-selection order from the current resolved order.
      const selectedInOrder = resolvedOrder.filter((id) => ids.has(id))
      const rest = resolvedOrder.filter((id) => !ids.has(id))
      persist([...selectedInOrder, ...rest])
    },
  }
}

/**
 * Archive set: a flat list of deck IDs the user has archived. Archived decks
 * are excluded from the study queue (and so from the resolved study order's
 * slot indexing). They surface only when the user toggles "Show archived" in
 * the utility row.
 */
export function useArchiveSet(): {
  archivedIds: ReadonlySet<string>
  isArchived:  (deckId: string) => boolean
  archive:     (deckId: string) => void
  restore:     (deckId: string) => void
  archiveMany: (deckIds: ReadonlyArray<string>) => void
} {
  const [archived, setArchived] = useState<ReadonlyArray<string>>([])

  useEffect(() => {
    setArchived(safeRead<string[]>(ARCHIVED_KEY, []))
  }, [])

  const set = useMemo(() => new Set(archived), [archived])

  const persist = useCallback((next: ReadonlyArray<string>) => {
    setArchived(next)
    safeWrite(ARCHIVED_KEY, next)
  }, [])

  return {
    archivedIds: set,
    isArchived:  (deckId) => set.has(deckId),
    archive:     (deckId) => persist([...new Set([...archived, deckId])]),
    restore:     (deckId) => persist(archived.filter((id) => id !== deckId)),
    archiveMany: (deckIds) => persist([...new Set([...archived, ...deckIds])]),
  }
}

/**
 * Local name overrides: if the server PATCH for rename fails or is unavailable
 * yet, the page can fall back to a local override so the user's rename still
 * appears to stick in the current device session. Keyed by deck ID.
 */
export function useLocalNameOverrides(): {
  nameFor:      (deckId: string, fallback: string) => string
  setNameOverride: (deckId: string, name: string | null) => void
} {
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    setOverrides(safeRead<Record<string, string>>(RESERVED_LOCAL_NAME_KEY, {}))
  }, [])

  return {
    nameFor: (deckId, fallback) => overrides[deckId] ?? fallback,
    setNameOverride: (deckId, name) => {
      const next = { ...overrides }
      if (name === null) {
        delete next[deckId]
      } else {
        next[deckId] = name
      }
      setOverrides(next)
      safeWrite(RESERVED_LOCAL_NAME_KEY, next)
    },
  }
}
