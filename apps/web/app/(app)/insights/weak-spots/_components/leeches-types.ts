import type {
  LeechDiagnosisFilter,
  LeechSortOrder,
  LeechStatusFilter,
} from '@/lib/actions/leeches.actions'

/**
 * UI-side filter shape. `'all'` is the wire-absent value for each column-
 * style dropdown — translated to "omit param" at the API layer in
 * `leeches-view.tsx` before calling `useLeechesQuery`.
 *
 * Kept independent of the wire types so the dropdowns can render a uniform
 * "All ___" option without each filter dropdown needing its own union with
 * `undefined`.
 */
export interface LeechFilters {
  status:    LeechStatusFilter
  deckId:    string | 'all'
  jlptLevel: string | 'all'
  diagnosis: LeechDiagnosisFilter | 'all'
  sort:      LeechSortOrder
}

export const INITIAL_LEECH_FILTERS: LeechFilters = {
  status:    'unresolved',
  deckId:    'all',
  jlptLevel: 'all',
  diagnosis: 'all',
  sort:      'mostRecent',
}
