'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  ChevronRight,
  Home,
  Layers,
  RefreshCw,
  Search,
  type LucideIcon,
} from 'lucide-react'

import { OfflineQueueBadge }              from './offline-queue-badge'
import type { NavIconKey, NavItemConfig } from './nav-config'

/**
 * PLACEHOLDER ICON REGISTRY (lucide-react).
 *
 * The custom geometric ink-stroke set described in DESIGN.md → §Icon System
 * was removed pending a fresh design pass. These lucide imports stand in
 * temporarily so the chrome remains functional. The Lucide Tax Rule is
 * suspended for THIS specific surface only, with explicit user direction
 * to use placeholders. When the custom set is rebuilt, swap these back to
 * the bespoke components and remove the lucide imports here.
 *
 * The Record<NavIconKey, ...> type stays exhaustive — adding a new key to
 * the union without adding a placeholder here is a TypeScript error.
 */
const NAV_ICON_REGISTRY: Record<NavIconKey, LucideIcon> = {
  dashboard: Home,
  review:    RefreshCw,
  decks:     Layers,
  browse:    Search,
  analytics: BarChart3,
}

interface NavItemProps {
  item: NavItemConfig
  /**
   * Called when the user activates the link. The MobileDrawer passes its
   * `close` action so tapping a nav row closes the drawer before the route
   * change takes effect. Sidebar omits this prop.
   */
  onNavigate?: () => void
  /** 0 = top-level item with icon; 1 = sub-nav child (no icon, indented). */
  level?: 0 | 1
}

function isMatch(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

const NOOP = (): void => {}

/**
 * The nav-row primitive shared by Sidebar and MobileDrawer.
 *
 * Active state anatomy (route-change settle, four beats):
 *   1. 2px Inari Vermillion top stripe draws in left-to-right (200ms).
 *   2. Vermillion Wash row background fades in (250ms, 50ms delay).
 *   3. Custom geometric ink-stroke icon paths draw on (300ms, 150ms delay,
 *      with per-path stagger via :nth-of-type in globals.css).
 *   4. Label color crossfades sumi-ink → inari-vermillion (200ms, 200ms delay).
 *
 * Hover state on non-active rows:
 *   - Icon strokes draw on + tint to vermillion via the `.nav-icon-stroke`
 *     rule and the icon's own `group-hover:text-inari-vermillion` class.
 *     The icon transition has no delay so it leads.
 *   - Row tint fades to Cream Inset with a 50ms transition delay so the
 *     row settles after the icon, reading as cause-and-effect.
 *
 * Reduced motion: `prefers-reduced-motion` already maps every animation
 * and transition to 0.01ms in `globals.css`. The end-state visual (stripe
 * + wash + vermillion text/icon + bold label on active) is preserved
 * because the static CSS rules always match — the keyframes just get
 * collapsed to instantaneous.
 */
export function NavItem({ item, onNavigate = NOOP, level = 0 }: NavItemProps): React.JSX.Element {
  const pathname    = usePathname()
  const Icon        = NAV_ICON_REGISTRY[item.iconKey]
  const children    = item.children ?? []
  const hasChildren = children.length > 0

  const matches      = isMatch(pathname, item.href)
  const childMatches = hasChildren && children.some((c) => isMatch(pathname, c.href))
  // Parent stays *inactive* when a child is active so we never show two active
  // states for one location.
  const isActive     = matches && !childMatches

  // Auto-expand when any descendant route is active. The user can override
  // via the chevron (collapse while on the parent, expand from elsewhere).
  // Any navigation drops the manual override so dropdowns close when the
  // user opens another link, regardless of section.
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const isExpanded = manualExpanded ?? matches

  useEffect(() => {
    setManualExpanded(null)
  }, [pathname])

  // Row-level classes. The `nav-row group` pair powers state-driven CSS in
  // globals.css (.nav-row[data-active="true"] selectors) and Tailwind's
  // group-hover / group-data-[active=true] modifiers on descendants. The
  // 2px corner radius matches the system's cut-paper register (cards and
  // buttons share it). min-h-[44px] hits the WCAG AA touch-target minimum
  // on mobile without bloating the desktop visual rhythm — py-2 already
  // provides comfortable internal padding.
  const linkBase = [
    'nav-row group relative overflow-hidden',
    'flex items-center gap-3',
    'min-h-[44px]',
    'rounded-[2px]',
    'text-base font-medium text-sumi-ink',
    'transition-colors duration-[200ms] delay-[50ms]',
    'hover:bg-cream-inset',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash',
    'data-[active=true]:bg-vermillion-wash',
    'data-[active=true]:text-inari-vermillion',
    'data-[active=true]:font-semibold',
    'data-[active=true]:animate-nav-row-wash-in',
    'flex-1 min-w-0',
  ].join(' ')

  const linkPad = level === 0 ? 'px-3 py-2' : 'pl-12 pr-3 py-1.5'

  return (
    <li>
      <div className="flex items-center gap-1.5 pr-1">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          data-active={isActive ? 'true' : undefined}
          className={`${linkBase} ${linkPad}`}
        >
          {/* The 2px Inari Vermillion top stripe — the brand identity device
              extended into chrome. Always rendered (not conditionally) so the
              leave transition (scale-1 → scale-0 over 200ms) plays cleanly
              when navigating away. The animation overlays the transition on
              mount-as-active for the route-change settle. */}
          <span
            aria-hidden="true"
            className="
              absolute top-0 inset-x-0 h-[2px]
              bg-inari-vermillion origin-left
              scale-x-0 transition-transform duration-[200ms]
              group-data-[active=true]:scale-x-100
              group-data-[active=true]:animate-nav-stripe-draw
              pointer-events-none
            "
          />

          {/* Icon: only rendered at level 0. Lucide-react placeholders (see
              NAV_ICON_REGISTRY note). 20px size at lucide's default 2.0
              stroke — the icons are designed for that weight, so anything
              thinner loses optical balance. Color transitions independently
              of the row bg so the icon leads on hover. */}
          {level === 0 && (
            <Icon
              size={20}
              className="
                relative z-[1] shrink-0
                text-faded-sumi
                transition-colors duration-[200ms]
                group-hover:text-inari-vermillion
                group-data-[active=true]:text-inari-vermillion
              "
            />
          )}

          {/* Label: relative+z-1 keeps it above the absolutely-positioned
              stripe span. The label-fade-in animation runs on route-change
              settle to crossfade color sumi-ink → inari-vermillion. */}
          <span className="relative z-[1] truncate group-data-[active=true]:animate-nav-label-fade-in">
            {item.label}
          </span>

          {item.hasOfflineBadge === true && <OfflineQueueBadge />}
        </Link>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setManualExpanded((prev) => (prev === null ? !matches : !prev))}
            aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={isExpanded}
            className="flex items-center justify-center w-11 h-11 shrink-0 rounded-[2px] text-sumi-ink hover:bg-cream-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors"
          >
            <ChevronRight
              size={16}
              aria-hidden="true"
              className={`shrink-0 transition-transform duration-[200ms] ease-out ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
        )}
      </div>

      {hasChildren && (
        <div
          inert={!isExpanded}
          className={`grid transition-[grid-template-rows] duration-[250ms] ease-out ${
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <ul className="overflow-hidden min-h-0 pt-1.5 space-y-0.5">
            {children.map((child) => (
              <NavItem key={child.href} item={child} onNavigate={onNavigate} level={1} />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
