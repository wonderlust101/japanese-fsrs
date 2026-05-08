'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { OfflineQueueBadge } from './offline-queue-badge'
import type { NavItemConfig } from './nav-config'

interface NavItemProps {
  item: NavItemConfig
  /**
   * Called when the user activates the link. The MobileDrawer passes its
   * `close` action so tapping a nav row closes the drawer before the route
   * change takes effect. Sidebar omits this prop.
   */
  onNavigate?: () => void
  /** 0 = top-level item with kanji glyph; 1 = sub-nav child (no glyph, indented). */
  level?: 0 | 1
}

function isMatch(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

const NOOP = (): void => {}

export function NavItem({ item, onNavigate = NOOP, level = 0 }: NavItemProps): React.JSX.Element {
  const pathname    = usePathname()
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

  const linkBase   = 'flex items-center gap-3 rounded-md text-base font-medium transition-colors flex-1 min-w-0'
  const linkPad    = level === 0 ? 'px-3 py-2' : 'pl-12 pr-3 py-1.5'
  const linkColors = isActive
    ? 'bg-inari-vermillion text-warm-paper-raised'
    : 'text-sumi-ink hover:bg-soft-hairline'

  return (
    <li>
      <div className="flex items-center gap-1.5 pr-1">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          className={[linkBase, linkPad, linkColors].join(' ')}
        >
          {level === 0 && (
            <span
              lang="ja"
              aria-hidden="true"
              className="text-lg font-medium w-5 text-center shrink-0"
            >
              {item.glyph}
            </span>
          )}
          <span className="truncate">{item.label}</span>
          {item.hasOfflineBadge === true && <OfflineQueueBadge />}
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setManualExpanded((prev) => (prev === null ? !matches : !prev))}
            aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={isExpanded}
            className="flex items-center justify-center w-10 h-10 shrink-0 rounded-md text-sumi-ink hover:bg-soft-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors"
          >
            <span
              aria-hidden="true"
              className={`inline-block text-xs leading-none transition-transform duration-[200ms] ease-out ${
                isExpanded ? 'rotate-90' : ''
              }`}
            >
              ▸
            </span>
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
