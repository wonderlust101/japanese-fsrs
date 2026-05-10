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
 * Server Components (Sidebar's `user` prop comes from `getAuthUser()`
 * server-side) without breaking the server-to-client serialization
 * boundary that React Server Components enforces around function refs.
 */

export type NavIconKey =
  | 'dashboard'
  | 'review'
  | 'decks'
  | 'browse'
  | 'analytics'

export interface NavItemConfig {
  href:             string
  iconKey:          NavIconKey
  label:            string
  hasOfflineBadge?: boolean
  children?:        NavItemConfig[]
}

export interface NavSectionConfig {
  label: string
  items: NavItemConfig[]
}

export const NAV_SECTIONS: NavSectionConfig[] = [
  {
    label: 'Practice',
    items: [
      { href: '/dashboard', iconKey: 'dashboard', label: 'Dashboard' },
      { href: '/review',    iconKey: 'review',    label: 'Review',    hasOfflineBadge: true },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        href:    '/decks',
        iconKey: 'decks',
        label:   'Decks',
        children: [
          { href: '/decks/browse', iconKey: 'browse', label: 'Browse' },
        ],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/analytics', iconKey: 'analytics', label: 'Analytics' },
    ],
  },
]
