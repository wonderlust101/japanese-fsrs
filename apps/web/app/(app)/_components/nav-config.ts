/**
 * Single source of truth for the navigation structure shared by the desktop
 * Sidebar and the MobileDrawer. Adding a top-level surface or a sub-nav
 * child here updates both chrome surfaces simultaneously.
 *
 * Section ordering follows the morning-ritual flow: Practice (what you do),
 * Library (what you study), Insights (what you've done).
 *
 * The config holds only serializable data (strings, primitives). Icon
 * components are resolved client-side via the registry in nav-item.tsx,
 * looked up by `iconKey`. This keeps the config file safe to import from
 * Server Components without breaking the server-to-client serialization
 * boundary that React Server Components enforces around function refs.
 */

export type NavIconKey =
  | 'home'
  | 'add'
  | 'review'
  | 'decks'
  | 'browse'
  | 'cards'
  | 'analytics'

export interface NavItemConfig {
  href:             string
  iconKey:          NavIconKey
  label:            string
  hasOfflineBadge?: boolean
  hasDueCount?:     boolean
  /**
   * Sidebar and drawer should attach a small unresolved-leech count chip to
   * the row label. The static flag lives here; live data is wired by the
   * rendering shell (`sidebar.tsx` / `mobile-drawer.tsx`), keeping this
   * config serializable across the RSC boundary.
   */
  hasLeechCount?:   boolean
  children?:        NavItemConfig[]
}

export interface NavSectionConfig {
  label:    string
  /** Section identity kanji shown next to the label in expanded chrome and
   *  alone (with tooltip) in the 64px collapsed rail. */
  kanji:    string
  items:    NavItemConfig[]
}

export const NAV_SECTIONS: NavSectionConfig[] = [
  {
    label: 'Practice',
    kanji: '練',
    items: [
      { href: '/today', iconKey: 'home', label: 'Today' },
      { href: '/add',   iconKey: 'add',  label: 'Add'   },
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
      {
        href:    '/insights',
        iconKey: 'analytics',
        label:   'Insights',
        children: [
          { href: '/insights',            iconKey: 'analytics', label: 'Overview'                          },
          { href: '/insights/mistakes',   iconKey: 'browse',    label: 'Mistakes'                          },
          { href: '/insights/leeches',    iconKey: 'browse',    label: 'Leeches',    hasLeechCount: true   },
          { href: '/insights/progress',   iconKey: 'browse',    label: 'Progress'                          },
          { href: '/insights/forecast',   iconKey: 'browse',    label: 'Forecast'                          },
          { href: '/insights/statistics', iconKey: 'browse',    label: 'Statistics'                        },
        ],
      },
    ],
  },
]
