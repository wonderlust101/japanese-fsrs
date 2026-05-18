import type {
  WeakSpotDiagnosisFilter,
  WeakSpotSortOrder,
  WeakSpotStatusFilter,
} from '@/lib/actions/weak-spots.actions'

/**
 * UI-side filter shape. `'all'` is the wire-absent value for each column-
 * style dropdown — translated to "omit param" at the API layer in
 * `weakSpots-view.tsx` before calling `useWeakSpotsQuery`.
 *
 * Kept independent of the wire types so the dropdowns can render a uniform
 * "All ___" option without each filter dropdown needing its own union with
 * `undefined`.
 */
export interface WeakSpotFilters {
  status:    WeakSpotStatusFilter
  deckId:    string | 'all'
  jlptLevel: string | 'all'
  diagnosis: WeakSpotDiagnosisFilter | 'all'
  sort:      WeakSpotSortOrder
}

export const INITIAL_WEAK_SPOT_FILTERS: WeakSpotFilters = {
  status:    'unresolved',
  deckId:    'all',
  jlptLevel: 'all',
  diagnosis: 'all',
  sort:      'mostRecent',
}
