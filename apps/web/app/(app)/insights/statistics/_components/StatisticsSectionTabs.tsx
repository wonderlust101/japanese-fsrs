'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

import { useExpandSection } from './section-collapse'
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
  const expandSection = useExpandSection()
  const [activeId, setActiveId] = useState<StatisticsSectionId>(
    STATISTICS_SECTIONS[0]?.id ?? STATISTICS_SECTIONS_BY_ID.retention.id,
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
    // Expand first so navigating to a collapsed section reveals it. The
    // scroll target is the section's top (carrying scroll-mt-32), which
    // doesn't move when the body below it expands.
    expandSection(id)
    const el = document.getElementById(id)
    if (el === null) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  return (
    <nav
      aria-label="Statistics sections"
      className={cn(
        // Negative margins exactly mirror the page container's padding
        // (`px-4 md:px-12 lg:px-16`) so the bar bleeds to precisely the
        // max-w-[1440px] container edge and never overshoots past it.
        'sticky top-16 z-10 -mx-4 md:-mx-12 lg:-mx-16',
        'border-b border-soft-hairline bg-cool-paper-base',
      )}
    >
      <ul
        className="-mx-px flex items-stretch overflow-x-auto whitespace-nowrap px-4 md:px-12 lg:px-16"
      >
        {STATISTICS_SECTIONS.map((section) => {
          const selected = section.id === activeId
          return (
            <li key={section.id} className="flex">
              <button
                type="button"
                aria-current={selected ? 'location' : undefined}
                onClick={() => handleClick(section.id)}
                className={cn(
                  'relative -mb-px flex min-h-[44px] items-center gap-x-2 px-4 py-3',
                  'font-mono text-sm',
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
                    'font-display text-md leading-none',
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
