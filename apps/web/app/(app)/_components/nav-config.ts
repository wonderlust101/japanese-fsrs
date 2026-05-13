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
  | 'review'
  | 'decks'
  | 'browse'
  | 'find-decks'
  | 'analytics'

export interface NavItemConfig {
  href:             string
  iconKey:          NavIconKey
  label:            string
  hasOfflineBadge?: boolean
  hasDueCount?:     boolean
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
      { href: '/dashboard', iconKey: 'home',   label: 'Home' },
      { href: '/review',    iconKey: 'review', label: 'Reviews', hasOfflineBadge: true, hasDueCount: true },
    ],
  },
  {
    label: 'Library',
    kanji: '書',
    items: [
      {
        href:    '/decks',
        iconKey: 'decks',
        label:   'Decks',
        children: [
          { href: '/decks',        iconKey: 'browse',     label: 'Browse decks' },
          { href: '/decks/browse', iconKey: 'find-decks', label: 'Find decks'   },
        ],
      },
    ],
  },
  {
    label: 'Insights',
    kanji: '析',
    items: [
      { href: '/analytics', iconKey: 'analytics', label: 'Analytics' },
    ],
  },
]
