'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { SETTINGS_SECTIONS } from './settings-sections'

/**
 * Horizontal tab bar for the /settings/* sub-routes. Sticks beneath the
 * TopBar and renders the three sections as kanji + label tabs, with a
 * 2px Inari Vermillion underline marking the active route. Same component
 * at every breakpoint: tabs are intrinsically narrow, so overflow-x-auto
 * only engages on extreme widths or future label growth.
 *
 * Replaces the previous desktop vertical rail + mobile pill row split.
 * One nav, one source of truth, one visual register.
 *
 * The active tab auto-scrolls itself to the horizontal center on route
 * change so the user never has to hunt for the current selection inside
 * a horizontally scrolled bar (a carry-over nicety from the old mobile
 * pill row).
 */
export function SettingsTabBar(): React.JSX.Element {
  const pathname = usePathname()
  const activeId = activeSectionFromPathname(pathname)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null || activeId === null) return
    const activeTab = container.querySelector<HTMLAnchorElement>(
      `[data-section-id="${activeId}"]`,
    )
    if (activeTab === null) return

    const tabRect       = activeTab.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    const offsetCenter =
      (tabRect.left + tabRect.width / 2) -
      (containerRect.left + containerRect.width / 2)
    container.scrollBy({ left: offsetCenter, behavior: 'smooth' })
  }, [activeId])

  return (
    <nav
      role="navigation"
      aria-label="Settings sections"
      className="sticky top-16 z-10 border-b border-soft-hairline bg-cool-paper-base"
    >
      <div
        ref={containerRef}
        className={[
          'mx-auto flex max-w-[52rem] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10',
          // Hide native scrollbar; the tab row is small and self-explanatory.
          '[scrollbar-width:none] [-ms-overflow-style:none]',
          '[&::-webkit-scrollbar]:hidden',
        ].join(' ')}
      >
        {SETTINGS_SECTIONS.map((section) => {
          const active = section.id === activeId
          return (
            <Link
              key={section.id}
              href={`/settings/${section.id}`}
              data-section-id={section.id}
              aria-current={active ? 'page' : undefined}
              className={[
                'group relative inline-flex shrink-0 items-baseline gap-2',
                'px-3 py-3 text-sm font-medium ui-motion-colors sm:px-4 sm:py-3.5',
                active ? 'text-sumi-ink' : 'text-faded-sumi hover:text-sumi-ink',
              ].join(' ')}
            >
              <span
                lang="ja"
                aria-hidden="true"
                className={[
                  'select-none font-display text-base leading-none ui-motion-colors',
                  active
                    ? 'text-inari-vermillion'
                    : 'text-faded-sumi/85 group-hover:text-faded-sumi',
                ].join(' ')}
              >
                {section.kanji}
              </span>
              <span>{section.label}</span>

              {/* Active underline. Sits at -bottom-px to overlap the nav's
                  1px soft-hairline baseline; the 2px vermillion segment
                  visually replaces the hairline for the active tab. */}
              <span
                aria-hidden="true"
                className={[
                  'absolute inset-x-3 -bottom-px h-[2px] transition-colors duration-200 ease-out sm:inset-x-4',
                  active ? 'bg-inari-vermillion' : 'bg-transparent',
                ].join(' ')}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function activeSectionFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter((s) => s.length > 0)
  if (segments[0] !== 'settings') return null
  return segments[1] ?? null
}
