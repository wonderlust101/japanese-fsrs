'use client'

import { useCallback, useEffect, useState } from 'react'

import type {
  CardMissingField,
  CardPresentField,
  CardSortField,
  CardStatusFilter,
  PitchPattern,
} from '@fsrs-japanese/shared-types'

/**
 * Saved views for /cards. Curated presets ship hard-coded as filter
 * recipes that map onto the cross-deck list endpoint; the active preset
 * key persists in localStorage so the user's choice survives a reload.
 *
 * A "view" here is a named filter recipe — picking one populates the
 * filter row. Custom (user-named) views are a follow-up; the localStorage
 * surface already supports them shape-wise.
 */

export interface SavedViewRecipe {
  search?:       string
  jlptLevel?:    'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond' | 'all'
  status?:       CardStatusFilter
  missingField?: CardMissingField
  presentField?: CardPresentField
  pitchPattern?: PitchPattern
  sort?:         CardSortField
}

export interface SavedView {
  id:          string
  label:       string
  description: string
  recipe:      SavedViewRecipe
  builtin:     boolean
}

/** Curated presets that ship with the app — every one of these maps to a
 *  filter combination the cross-deck list endpoint actually supports. */
export const BUILTIN_VIEWS: ReadonlyArray<SavedView> = [
  {
    id:          'recent',
    label:       'Recently added',
    description: 'Newest cards across every deck.',
    recipe:      { sort: 'recent' },
    builtin:     true,
  },
  {
    id:          'low-mastery',
    label:       'Low mastery',
    description: 'Cards with the most lapses first.',
    recipe:      { sort: 'lapses' },
    builtin:     true,
  },
  {
    id:          'suspended',
    label:       'Suspended',
    description: 'Cards paused from the review queue.',
    recipe:      { status: 'suspended' },
    builtin:     true,
  },
  {
    id:          'missing-mnemonic',
    label:       'Missing mnemonics',
    description: 'Cards without a memory hook.',
    recipe:      { missingField: 'mnemonic' },
    builtin:     true,
  },
  {
    id:          'missing-example',
    label:       'Missing example',
    description: 'Cards with no example sentence yet.',
    recipe:      { missingField: 'example' },
    builtin:     true,
  },
  {
    id:          'missing-picture',
    label:       'Missing picture',
    description: 'Cards without a picture field.',
    recipe:      { missingField: 'picture' },
    builtin:     true,
  },
]

const ACTIVE_KEY = 'tomo.cards.activeView.v1'

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
    // Quota / privacy mode — silently no-op; the active view stays in memory.
  }
}

/**
 * Resolved set of saved views (built-in only for now) plus persistence for
 * the active view id. Custom user-defined views are a follow-up — the
 * shape is ready for them.
 */
export function useSavedViews(): {
  views:        ReadonlyArray<SavedView>
  activeId:     string | null
  setActiveId:  (id: string | null) => void
  byId:         (id: string) => SavedView | undefined
} {
  const [activeId, setActiveIdState] = useState<string | null>(null)

  useEffect(() => {
    setActiveIdState(safeRead<string | null>(ACTIVE_KEY, null))
  }, [])

  const setActiveId = useCallback((next: string | null) => {
    setActiveIdState(next)
    safeWrite(ACTIVE_KEY, next)
  }, [])

  const byId = useCallback(
    (id: string): SavedView | undefined => BUILTIN_VIEWS.find((v) => v.id === id),
    [],
  )

  return {
    views: BUILTIN_VIEWS,
    activeId,
    setActiveId,
    byId,
  }
}
