'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

import {
  IconAnalytics,
  IconBrowse,
  IconDashboard,
  IconDecks,
  IconReview,
}                                           from '@/components/icons/chrome-marks'
import { OfflineQueueBadge }                from './offline-queue-badge'
import type { NavIconKey, NavItemConfig }   from './nav-config'

/**
 * Bespoke chrome-marks icon registry for production navigation.
 *
 * The Record<NavIconKey, ...> type stays exhaustive: adding a new key to
 * NavIconKey without adding a component here is a TypeScript error.
 *
 * Icons are static. Color/state inherits from the parent row via
 * `currentColor`; the icon never animates on hover or active.
 */
const NAV_ICON_REGISTRY: Record<NavIconKey, (props: { className?: string }) => React.JSX.Element> = {
  home:         IconDashboard,
  review:       IconReview,
  decks:        IconDecks,
  browse:       IconBrowse,
  'find-decks': IconBrowse,
  analytics:    IconAnalytics,
}

interface NavItemProps {
  item: NavItemConfig
  /**
   * Called when the user activates the link. The MobileDrawer passes its
   * `close` action so tapping a nav row closes the drawer before the route
   * change. Sidebar omits this prop.
   */
  onNavigate?: () => void
  /** 0 = top-level item with icon; 1 = sub-nav child (no icon, indented). */
  level?: 0 | 1
  /** Icon-only rail rendering at 64px width. Label becomes sr-only; chevron
   *  and trailing chrome hide. Used by the Sidebar's collapsed state. */
  collapsed?: boolean
  /** Optional second line under the main label. Used to lift the Reviews
   *  row to a soft CTA when due > 0: e.g. "12 cards · ~6 min". Ignored in
   *  collapsed rail (label is sr-only there). */
  subLabel?: string
  /** External override for active state. When provided, takes precedence
   *  over the locally-computed pathname match. Used by parent rows with
   *  prefix-sharing siblings (e.g. `/decks` and `/decks/browse`) so only
   *  the longest matching child renders as active. */
  forceActive?: boolean
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
 *   3. Icon paths draw on (300ms, 150ms delay, per-path stagger via :nth-of-type).
 *   4. Label color crossfades sumi-ink → inari-vermillion (200ms, 200ms delay).
 *
 * Reduced motion: `prefers-reduced-motion` already maps every animation
 * and transition to 0.01ms in `globals.css`. The end-state visual is
 * preserved because the static CSS rules always match.
 */
export function NavItem({
  item,
  onNavigate = NOOP,
  level      = 0,
  collapsed  = false,
  subLabel,
  forceActive,
}: NavItemProps): React.JSX.Element {
  const pathname    = usePathname()
  const Icon        = NAV_ICON_REGISTRY[item.iconKey]
  const children    = item.children ?? []
  const hasChildren = children.length > 0

  const childMatches = hasChildren && children.some((c) => isMatch(pathname, c.href))
  // Parent stays *inactive* when a child is active so we never show two active
  // states for one location.
  const matches  = isMatch(pathname, item.href)
  const isActive = forceActive ?? (matches && !childMatches)

  // Among children with prefix-sharing hrefs (e.g. `/decks` vs `/decks/browse`),
  // only the longest matching href should render active. Computing it here
  // (where sibling context is available) and forwarding via `forceActive` is
  // the only place we can resolve the ambiguity — each child NavItem on its
  // own sees only its own href and can't tell that a more-specific sibling
  // is the better match.
  const activeChildHref = hasChildren
    ? children
        .filter((c) => isMatch(pathname, c.href))
        .reduce<string | null>(
          (best, c) => (best === null || c.href.length > best.length ? c.href : best),
          null,
        )
    : null

  // First-entry-only auto-expand: when the user enters a child route for the
  // first time this session, the section opens once so they can see where
  // they are. After that, the user's manual collapse choice is respected.
  // hasAutoExpanded ref tracks the one-time event.
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const hasAutoExpanded = useRef(false)

  useEffect(() => {
    if (!hasChildren) return
    if (childMatches && !hasAutoExpanded.current) {
      setManualExpanded(true)
      hasAutoExpanded.current = true
    }
  }, [childMatches, hasChildren])

  // Reset manual override when the route changes externally so dropdowns
  // close when the user opens another link, regardless of section.
  useEffect(() => {
    if (!childMatches) setManualExpanded(null)
  }, [pathname, childMatches])

  const isExpanded = manualExpanded ?? childMatches

  // --- Collapsed rail rendering: icon-only leaf row ----------------------
  if (collapsed && level === 0) {
    const containerActive = isActive || childMatches
    return (
      <li>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          data-active={containerActive ? 'true' : undefined}
          title={item.label}
          className={[
            'nav-row group relative overflow-hidden rounded-[2px]',
            'flex items-center justify-center',
            'min-h-[44px] w-12 mx-auto',
            'text-sumi-ink transition-colors duration-[200ms]',
            'hover:bg-cream-inset',
            'data-[active=true]:bg-vermillion-wash',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className="absolute top-0 inset-x-0 h-[2px] bg-inari-vermillion origin-left scale-x-0 transition-transform duration-[200ms] group-data-[active=true]:scale-x-100 pointer-events-none"
          />
          <Icon
            className="
              relative z-[1] shrink-0 w-7 h-7
              text-faded-sumi transition-colors duration-[200ms]
              group-hover:text-inari-vermillion
              group-data-[active=true]:text-inari-vermillion
            "
          />
          <span className="sr-only">{item.label}</span>
          {item.hasOfflineBadge === true && <OfflineQueueBadge floating />}
        </Link>
      </li>
    )
  }

  // --- Expanded rendering: leaf or parent ------------------------------------
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

  // Parent rows (those with children) are not links — they are disclosure
  // buttons. The whole row toggles the dropdown; the chevron lives inside the
  // same button as a decorative affordance. This keeps the row to a single
  // tab stop and lets `aria-expanded` apply to the entire visible target.
  if (hasChildren) {
    const toggle = (): void =>
      setManualExpanded((prev) => (prev === null ? !childMatches : !prev))

    return (
      <li>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          className={`${linkBase} ${linkPad} w-full text-left appearance-none bg-transparent`}
        >
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

          {level === 0 && (
            <Icon
              className="
                relative z-[1] shrink-0 w-6 h-6
                text-faded-sumi
                transition-colors duration-[200ms]
                group-hover:text-inari-vermillion
                group-data-[active=true]:text-inari-vermillion
              "
            />
          )}

          <span className="relative z-[1] truncate flex-1 group-data-[active=true]:animate-nav-label-fade-in">
            {item.label}
          </span>

          <ChevronRight
            size={16}
            aria-hidden="true"
            className={`relative z-[1] shrink-0 text-faded-sumi transition-transform duration-[200ms] ease-out group-hover:text-sumi-ink ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </button>

        <div
          inert={!isExpanded}
          className={`grid transition-[grid-template-rows] duration-[250ms] ease-out ${
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <ul className="overflow-hidden min-h-0 pt-1.5 space-y-0.5">
            {children.map((child) => (
              <NavItem
                key={child.href}
                item={child}
                onNavigate={onNavigate}
                level={1}
                forceActive={child.href === activeChildHref}
              />
            ))}
          </ul>
        </div>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        data-active={isActive ? 'true' : undefined}
        className={`${linkBase} ${linkPad}`}
      >
        {/* 2px Inari Vermillion top stripe: brand identity device extended
            into chrome. Always rendered so the leave transition plays
            cleanly when navigating away. */}
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

        {/* Icon: only rendered at level 0. */}
        {level === 0 && (
          <Icon
            className="
              relative z-[1] shrink-0 w-6 h-6
              text-faded-sumi
              transition-colors duration-[200ms]
              group-hover:text-inari-vermillion
              group-data-[active=true]:text-inari-vermillion
            "
          />
        )}

        {/* Label + optional subLabel stacked when subLabel is present. */}
        {subLabel === undefined ? (
          <span className="relative z-[1] truncate group-data-[active=true]:animate-nav-label-fade-in">
            {item.label}
          </span>
        ) : (
          <span className="relative z-[1] flex flex-col min-w-0">
            <span className="truncate leading-tight group-data-[active=true]:animate-nav-label-fade-in">
              {item.label}
            </span>
            <span className="truncate text-xs text-faded-sumi leading-tight font-normal mt-0.5">
              {subLabel}
            </span>
          </span>
        )}

        {item.hasOfflineBadge === true && <OfflineQueueBadge />}
      </Link>
    </li>
  )
}
