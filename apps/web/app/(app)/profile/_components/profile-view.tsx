'use client'

import { useCallback, useEffect, useState } from 'react'

import { TopBar } from '@/app/(app)/_components/top-bar'
import type { Profile } from '@fsrs-japanese/shared-types'

import { DirectionBento }    from './direction-bento'
import { DirectionFloat }    from './direction-float'
import { DirectionPostcard } from './direction-postcard'
import { DirectionRoll }     from './direction-roll'
import { DirectionSections, type SectionVariants } from './direction-sections'
import { DirectionSolo }     from './direction-solo'
import { DirectionStack }    from './direction-stack'
import {
  PROFILE_TOOLBAR_TOGGLE_EVENT,
  ProfileDevToolbar,
} from './profile-dev-toolbar'
import { BASICINFO_VARIANTS, type BasicInfoVariant } from './section-basicinfo'
import { CADENCE_VARIANTS,   type CadenceVariant }   from './section-cadence'
import { CURRENTLY_VARIANTS, type CurrentlyVariant } from './section-currently'
import { MASTHEAD_VARIANTS,  type MastheadVariant }  from './section-masthead'
import { SHELF_VARIANTS,     type ShelfVariant }     from './section-shelf'

export type ProfileDirection =
  | 'sectioned'
  | 'stack'
  | 'solo'
  | 'bento'
  | 'roll'
  | 'postcard'
  | 'float'

const DIRECTION_VALUES: readonly ProfileDirection[] = [
  'sectioned', 'stack', 'solo', 'bento', 'roll', 'postcard', 'float',
]

/** Narrow a string to a known ProfileDirection. The legacy
 *  'sectioned-cards' value (used during the V1/V2 split) maps to
 *  'sectioned' so users with that key cached in localStorage are
 *  silently migrated rather than dropped back to the default. */
function isProfileDirection(value: string): value is ProfileDirection {
  return (DIRECTION_VALUES as readonly string[]).includes(value)
}

function normalizeStoredDirection(value: string | null): ProfileDirection | null {
  if (value === null) return null
  if (value === 'sectioned-cards') return 'sectioned'
  if (isProfileDirection(value))   return value
  return null
}

/**
 * Production-default direction. The sectioned composition (carded,
 * built on SectionCard) is the active design. Legacy whole-page
 * directions stay accessible via the dev toolbar for historical
 * reference only.
 */
const PRODUCTION_DIRECTION: ProfileDirection = 'sectioned'

/**
 * Defaults reflect the locked picks:
 * M4 (stamped), B2 (definition list for basic info), C3 (stripe),
 * Cu2 (deck-led with private indicator), S1 (indexed with see-more).
 * Retention and Recent reviews were retired.
 */
const DEFAULT_SECTION_VARIANTS: SectionVariants = {
  masthead:  'stamped',
  basicInfo: 'dl',
  cadence:   'stripe',
  currently: 'deck',
  shelf:     'indexed',
}

const STORAGE_KEYS = {
  direction:   'tomo:dev:profile-toolbar.direction',
  toolbarOpen: 'tomo:dev:profile-toolbar.open',
  minimized:   'tomo:dev:profile-toolbar.minimized',
  sectMast:    'tomo:dev:profile-toolbar.section-masthead',
  sectBasic:   'tomo:dev:profile-toolbar.section-basicinfo',
  sectCad:     'tomo:dev:profile-toolbar.section-cadence',
  sectCur:     'tomo:dev:profile-toolbar.section-currently',
  sectShelf:   'tomo:dev:profile-toolbar.section-shelf',
} as const

const IS_DEV = process.env.NODE_ENV === 'development'

interface Props {
  profile:     Profile
  email:       string
  displayName: string
  joinedAt:    string
}

/** Narrow a persisted localStorage value to a known variant id, or fall
 *  back to a default. Defensive against schema drift (e.g. variant
 *  removed from the source code). */
function readVariant<V extends string>(
  key:      string,
  allowed:  readonly V[],
  fallback: V,
): V {
  try {
    const persisted = window.localStorage.getItem(key)
    if (persisted !== null && (allowed as readonly string[]).includes(persisted)) {
      return persisted as V
    }
  } catch {
    // private-browsing modes can throw on localStorage access
  }
  return fallback
}

/**
 * Profile page's parent client component. Owns:
 *  - the active direction (sectioned by default; legacy V1–V6 via toolbar)
 *  - per-section variant state (the 6 sub-pickers, each with 4 variants)
 *  - dev-toolbar open/minimized state, all persisted to localStorage
 *
 * Production renders only the active direction; the toolbar machinery is
 * gated on NODE_ENV and dead-code-eliminated in the build.
 */
export function ProfileView(props: Props): React.JSX.Element {
  const [direction,   setDirection]   = useState<ProfileDirection>(PRODUCTION_DIRECTION)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [minimized,   setMinimized]   = useState(false)
  const [sectionVariants, setSectionVariants] = useState<SectionVariants>(DEFAULT_SECTION_VARIANTS)

  // Hydrate dev state from localStorage on mount.
  useEffect(() => {
    if (!IS_DEV) return
    try {
      const persistedDirection = normalizeStoredDirection(
        window.localStorage.getItem(STORAGE_KEYS.direction),
      )
      if (persistedDirection !== null) setDirection(persistedDirection)

      setToolbarOpen(window.localStorage.getItem(STORAGE_KEYS.toolbarOpen) === '1')
      setMinimized( window.localStorage.getItem(STORAGE_KEYS.minimized)   === '1')

      setSectionVariants({
        masthead:  readVariant<MastheadVariant>(STORAGE_KEYS.sectMast,  MASTHEAD_VARIANTS,  DEFAULT_SECTION_VARIANTS.masthead),
        basicInfo: readVariant<BasicInfoVariant>(STORAGE_KEYS.sectBasic, BASICINFO_VARIANTS, DEFAULT_SECTION_VARIANTS.basicInfo),
        cadence:   readVariant<CadenceVariant>(STORAGE_KEYS.sectCad,    CADENCE_VARIANTS,   DEFAULT_SECTION_VARIANTS.cadence),
        currently: readVariant<CurrentlyVariant>(STORAGE_KEYS.sectCur,  CURRENTLY_VARIANTS, DEFAULT_SECTION_VARIANTS.currently),
        shelf:     readVariant<ShelfVariant>(STORAGE_KEYS.sectShelf,    SHELF_VARIANTS,     DEFAULT_SECTION_VARIANTS.shelf),
      })
    } catch {
      // private-browsing modes can throw on localStorage access; defaults stay.
    }
  }, [])

  // Listen for the FloatingLauncher's toggle event.
  useEffect(() => {
    if (!IS_DEV) return
    function handleToggle(): void {
      setToolbarOpen((prev) => {
        const next = !prev
        try { window.localStorage.setItem(STORAGE_KEYS.toolbarOpen, next ? '1' : '0') } catch { /* private */ }
        return next
      })
    }
    window.addEventListener(PROFILE_TOOLBAR_TOGGLE_EVENT, handleToggle)
    return () => window.removeEventListener(PROFILE_TOOLBAR_TOGGLE_EVENT, handleToggle)
  }, [])

  const persist = useCallback((key: string, value: string): void => {
    if (!IS_DEV) return
    try { window.localStorage.setItem(key, value) } catch { /* private */ }
  }, [])

  const setDirectionAndPersist = useCallback((next: ProfileDirection): void => {
    setDirection(next)
    persist(STORAGE_KEYS.direction, next)
  }, [persist])

  const setMinimizedAndPersist = useCallback((next: boolean): void => {
    setMinimized(next)
    persist(STORAGE_KEYS.minimized, next ? '1' : '0')
  }, [persist])

  const closeToolbar = useCallback((): void => {
    setToolbarOpen(false)
    persist(STORAGE_KEYS.toolbarOpen, '0')
  }, [persist])

  // Per-section variant setters. Each persists immediately so a reload
  // brings back exactly the composition the user was iterating on.
  const setMasthead = useCallback((next: MastheadVariant): void => {
    setSectionVariants((prev) => ({ ...prev, masthead: next }))
    persist(STORAGE_KEYS.sectMast, next)
  }, [persist])

  const setBasicInfo = useCallback((next: BasicInfoVariant): void => {
    setSectionVariants((prev) => ({ ...prev, basicInfo: next }))
    persist(STORAGE_KEYS.sectBasic, next)
  }, [persist])

  const setCadence = useCallback((next: CadenceVariant): void => {
    setSectionVariants((prev) => ({ ...prev, cadence: next }))
    persist(STORAGE_KEYS.sectCad, next)
  }, [persist])

  const setCurrently = useCallback((next: CurrentlyVariant): void => {
    setSectionVariants((prev) => ({ ...prev, currently: next }))
    persist(STORAGE_KEYS.sectCur, next)
  }, [persist])

  const setShelf = useCallback((next: ShelfVariant): void => {
    setSectionVariants((prev) => ({ ...prev, shelf: next }))
    persist(STORAGE_KEYS.sectShelf, next)
  }, [persist])

  return (
    <>
      <TopBar>
        <h1 className="flex-1 font-display text-xl font-medium text-sumi-ink">
          Profile
        </h1>
      </TopBar>

      {direction === 'sectioned' && (
        <DirectionSections {...props} variants={sectionVariants} />
      )}
      {direction === 'stack'    && <DirectionStack    {...props} />}
      {direction === 'solo'     && <DirectionSolo     {...props} />}
      {direction === 'bento'    && <DirectionBento    {...props} />}
      {direction === 'roll'     && <DirectionRoll     {...props} />}
      {direction === 'postcard' && <DirectionPostcard {...props} />}
      {direction === 'float'    && <DirectionFloat    {...props} />}

      {IS_DEV && toolbarOpen && (
        <ProfileDevToolbar
          direction={direction}
          minimized={minimized}
          sectionVariants={sectionVariants}
          onDirectionChange={setDirectionAndPersist}
          onMastheadChange={setMasthead}
          onBasicInfoChange={setBasicInfo}
          onCadenceChange={setCadence}
          onCurrentlyChange={setCurrently}
          onShelfChange={setShelf}
          onMinimize={() => setMinimizedAndPersist(true)}
          onExpand={() => setMinimizedAndPersist(false)}
          onClose={closeToolbar}
        />
      )}
    </>
  )
}
