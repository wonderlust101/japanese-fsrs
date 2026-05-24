'use client'

import type {
  WeakSpotDiagnosisFilter,
  WeakSpotSortOrder,
  WeakSpotStatusFilter,
} from '@/lib/actions/weak-spots.actions'

import { INITIAL_WEAK_SPOT_FILTERS, type WeakSpotFilters } from './weak-spots-types'

/**
 * URL ↔ WeakSpotFilters serialization. The /weak-spots URL is the single source
 * of truth for filter/sort/search state (mirrors the Cards browser's
 * `cards-filter-state.ts`), so a filtered view is shareable and deep-linkable.
 * Defaults are omitted from the URL to keep clean links; the search term lives
 * in the URL too so a shared link reproduces it.
 */

// Tolerant parse: any token outside the whitelist falls back to the per-field
// default, so a hand-typed URL can never crash the page.
const STATUS_TOKENS: ReadonlySet<WeakSpotStatusFilter> = new Set(['unresolved', 'resolved'])
const JLPT_TOKENS: ReadonlySet<string> = new Set(['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt'])
const DIAGNOSIS_TOKENS: ReadonlySet<WeakSpotDiagnosisFilter> = new Set(['available', 'missing'])
const SORT_TOKENS: ReadonlySet<WeakSpotSortOrder> = new Set([
  'mostRecent', 'oldestUnresolved', 'mostLapses', 'deckOrder',
])
const DIR_TOKENS: ReadonlySet<'asc' | 'desc'> = new Set(['asc', 'desc'])

export function parseWeakSpotFiltersFromURL(
  read: (key: string) => string | null,
): WeakSpotFilters {
  const next: WeakSpotFilters = { ...INITIAL_WEAK_SPOT_FILTERS }

  const status = read('status')
  if (status !== null && STATUS_TOKENS.has(status as WeakSpotStatusFilter)) {
    next.status = status as WeakSpotStatusFilter
  }

  const deck = read('deck')
  if (deck !== null && deck.length > 0) next.deckId = deck

  const jlpt = read('jlpt')
  if (jlpt !== null && JLPT_TOKENS.has(jlpt)) next.jlptLevel = jlpt

  const diag = read('diag')
  if (diag !== null && DIAGNOSIS_TOKENS.has(diag as WeakSpotDiagnosisFilter)) {
    next.diagnosis = diag as WeakSpotDiagnosisFilter
  }

  const sort = read('sort')
  if (sort !== null && SORT_TOKENS.has(sort as WeakSpotSortOrder)) {
    next.sort = sort as WeakSpotSortOrder
  }

  const dir = read('dir')
  if (dir !== null && DIR_TOKENS.has(dir as 'asc' | 'desc')) {
    next.sortDir = dir as 'asc' | 'desc'
  }

  const q = read('q')
  if (q !== null && q.length > 0) next.search = q

  // Legacy fold: the standalone `oldestUnresolved` mode is now `mostRecent`
  // read ascending (mirrors the prior localStorage migration).
  if (next.sort === 'oldestUnresolved') {
    next.sort = 'mostRecent'
    next.sortDir = 'asc'
  }

  return next
}

export function serializeWeakSpotFiltersToURL(state: WeakSpotFilters): URLSearchParams {
  const out = new URLSearchParams()
  if (state.status    !== 'unresolved') out.set('status', state.status)
  if (state.deckId    !== 'all')        out.set('deck',   state.deckId)
  if (state.jlptLevel !== 'all')        out.set('jlpt',   state.jlptLevel)
  if (state.diagnosis !== 'all')        out.set('diag',   state.diagnosis)
  if (state.sort      !== 'mostRecent') out.set('sort',   state.sort)
  if (state.sortDir   !== null)         out.set('dir',    state.sortDir)
  if (state.search.length > 0)          out.set('q',      state.search)
  return out
}
