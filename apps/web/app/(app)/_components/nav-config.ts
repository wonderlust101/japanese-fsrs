/**
 * Single source of truth for the navigation structure shared by the desktop
 * Sidebar and the MobileDrawer. Adding a top-level surface or a sub-nav child
 * here updates both chrome surfaces simultaneously.
 *
 * Section ordering follows the morning-ritual flow: Practice (what you do),
 * Library (what you study), Insights (what you've done), Account.
 *
 * Glyph mapping uses single kanji per the Kanji-as-Nav Rule (DESIGN.md);
 * each glyph is N5–N3 vocabulary the learner is also studying.
 */

export interface NavItemConfig {
  href:             string
  glyph:            string
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
      { href: '/dashboard', glyph: '家', label: 'Dashboard' },
      { href: '/review',    glyph: '復', label: 'Review', hasOfflineBadge: true },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        href:  '/decks',
        glyph: '本',
        label: 'Decks',
        children: [
          { href: '/decks/browse', glyph: '探', label: 'Browse' },
        ],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/analytics', glyph: '統', label: 'Analytics' },
    ],
  },
]
