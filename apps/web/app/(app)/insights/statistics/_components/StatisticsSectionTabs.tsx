'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

import { STATISTICS_SECTIONS, STATISTICS_SECTIONS_BY_ID, type StatisticsSectionId } from './sections'

/**
 * Sticky section-nav for the Statistics page. Renders the five section
 * labels as anchor links that scroll smoothly to their target sections,
 * and tracks the most-visible section via `IntersectionObserver` so the
 * active tab updates as the user scrolls. The bar sticks beneath the
 * page's TopBar at desktop and tablet widths; on narrow viewports it
 * scrolls horizontally to keep all five labels reachable.
 */
export function StatisticsSectionTabs(): React.JSX.Element {
  const [activeId, setActiveId] = useState<StatisticsSectionId>(
    STATISTICS_SECTIONS_BY_ID.activity.id,
  )

  useEffect(() => {
    const sections = STATISTICS_SECTIONS.map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    // Slight rootMargin offset so a section counts as "active" as soon as
    // it enters the upper third of the viewport — feels natural during scroll.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target.id
        if (typeof top === 'string') {
          setActiveId(top as StatisticsSectionId)
        }
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold:  [0, 0.25, 0.5, 0.75, 1],
      },
    )

    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleClick = (id: StatisticsSectionId): void => {
    const el = document.getElementById(id)
    if (el === null) return
    // The section element carries `scroll-mt-32` so the browser respects
    // the sticky TopBar + tab bar combined height automatically.
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  return (
    <nav
      aria-label="Statistics sections"
      className={cn(
        'sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-12 xl:-mx-16',
        'border-b border-soft-hairline bg-cool-paper-base',
      )}
    >
      <ul
        role="tablist"
        className="-mx-px flex items-stretch overflow-x-auto whitespace-nowrap px-4 sm:px-6 lg:px-12 xl:px-16"
      >
        {STATISTICS_SECTIONS.map((section) => {
          const selected = section.id === activeId
          return (
            <li key={section.id} role="presentation" className="flex">
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                aria-current={selected ? 'true' : undefined}
                onClick={() => handleClick(section.id)}
                className={cn(
                  'relative -mb-px flex items-baseline gap-x-2 px-4 py-3',
                  'font-mono text-[0.75rem] uppercase tracking-[0.16em]',
                  'transition-colors duration-150 ease-out',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-4',
                  selected
                    ? 'text-sumi-ink'
                    : 'text-faded-sumi hover:text-sumi-ink',
                )}
              >
                <span
                  lang="ja"
                  aria-hidden="true"
                  className={cn(
                    'font-display text-[1rem] leading-none',
                    selected ? 'text-inari-vermillion' : 'text-faded-sumi/70',
                  )}
                >
                  {section.kanji}
                </span>
                <span>{section.label}</span>
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-[2px] bg-inari-vermillion"
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
