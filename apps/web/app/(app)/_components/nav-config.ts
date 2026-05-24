/**
 * Single source of truth for the navigation structure shared by the desktop
 * Sidebar and the MobileDrawer. Adding a top-level surface or a sub-nav
 * child here updates both chrome surfaces simultaneously.
 *
 * Section ordering follows the morning-ritual flow: Study (what you do
 * with cards today), Library (what you study), Insights (what you've done).
 *
 * The config holds only serializable data (strings, primitives). Icon
 * components are resolved client-side via the registry in nav-item.tsx,
 * looked up by `iconKey`. This keeps the config file safe to import from
 * Server Components without breaking the server-to-client serialization
 * boundary that React Server Components enforces around function refs.
 */

export type NavIconKey =
  | 'reviews'
  | 'weakSpots'
  | 'decks'
  | 'cards'
  | 'overview'
  | 'progress'
  | 'forecast'
  | 'statistics'

export interface NavItemConfig {
  href:             string
  iconKey:          NavIconKey
  label:            string
  hasOfflineBadge?: boolean
  hasDueCount?:     boolean
  /**
   * Sidebar and drawer should attach a small unresolved-weakSpot count chip to
   * the row label. The static flag lives here; live data is wired by the
   * rendering shell (`sidebar.tsx` / `mobile-drawer.tsx`), keeping this
   * config serializable across the RSC boundary.
   */
  hasWeakSpotCount?:   boolean
  children?:        NavItemConfig[]
}

export interface NavSectionConfig {
  label:    string
  /** Section identity kanji shown next to the label in expanded chrome and
   *  alone (with tooltip) in the 64px collapsed rail. */
  kanji:    string
  items:    NavItemConfig[]
}

/**
 * Hrefs that are strict path-prefixes of any other nav href in the config.
 * Those hrefs must use exact-equality matching for active state — otherwise
 * a parent-ish row like `/insights` would light up alongside its more-
 * specific sibling rows (`/insights/progress`, `/weak-spots`, …)
 * whenever the user lands on one of them.
 *
 * Derived at module load by flattening the tree and checking, for each
 * href, whether any *other* href in the set starts with `href + '/'`.
 * Adding a new prefix-sharing pair never needs a manual flag.
 */
function collectHrefs(items: NavItemConfig[]): string[] {
  const out: string[] = []
  for (const item of items) {
    out.push(item.href)
    if (item.children !== undefined) out.push(...collectHrefs(item.children))
  }
  return out
}

function buildExactMatchSet(sections: NavSectionConfig[]): Set<string> {
  const hrefs = sections.flatMap((s) => collectHrefs(s.items))
  const exact = new Set<string>()
  for (const a of hrefs) {
    if (hrefs.some((b) => b !== a && b.startsWith(a + '/'))) {
      exact.add(a)
    }
  }
  return exact
}

export const NAV_SECTIONS: NavSectionConfig[] = [
  {
    label: 'Study',
    kanji: '練',
    items: [
      { href: '/today',            iconKey: 'reviews', label: 'Reviews', hasDueCount: true   },
      { href: '/weak-spots', iconKey: 'weakSpots', label: 'Weak spots', hasWeakSpotCount: true },
    ],
  },
  {
    label: 'Library',
    kanji: '書',
    items: [
      { href: '/decks', iconKey: 'decks', label: 'Decks' },
      { href: '/cards', iconKey: 'cards', label: 'Cards' },
    ],
  },
  {
    label: 'Insights',
    kanji: '析',
    items: [
      { href: '/insights',            iconKey: 'overview',   label: 'Overview'   },
      { href: '/insights/progress',   iconKey: 'progress',   label: 'Progress'   },
      { href: '/insights/forecast',   iconKey: 'forecast',   label: 'Forecast'   },
      { href: '/insights/statistics', iconKey: 'statistics', label: 'Statistics' },
    ],
  },
]

export const EXACT_MATCH_HREFS: ReadonlySet<string> = buildExactMatchSet(NAV_SECTIONS)
