import type { StatisticsSection as SectionMeta } from './sections'

interface StatisticsSectionProps {
  section:  SectionMeta
  children: React.ReactNode
  /** Optional right slot for a per-section control (e.g. time range tabs). */
  rightSlot?: React.ReactNode
}

/**
 * One Statistics-page section. Renders an anchored h2 (kanji + label + the
 * teacher question) followed by the section body. The anchor id matches
 * `section.id`, which the sticky tab bar's IntersectionObserver targets.
 */
export function StatisticsSection({
  section,
  children,
  rightSlot,
}: StatisticsSectionProps): React.JSX.Element {
  const ariaId = `${section.id}-heading`
  return (
    <section
      id={section.id}
      aria-labelledby={ariaId}
      className="scroll-mt-32"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-soft-hairline pb-4 lg:mb-8 lg:pb-5">
        <div className="flex flex-col gap-y-1">
          <h2
            id={ariaId}
            className="flex items-baseline gap-x-3"
          >
            <span
              lang="ja"
              aria-hidden="true"
              className="select-none font-display text-[1.875rem] leading-none text-inari-vermillion"
            >
              {section.kanji}
            </span>
            <span className="font-mono text-[0.8125rem] uppercase tracking-[0.18em] text-sumi-ink/85">
              {section.label}
            </span>
          </h2>
          <p className="max-w-[58ch] text-[0.9375rem] italic leading-relaxed text-faded-sumi">
            {section.question}
          </p>
        </div>
        {rightSlot !== undefined && (
          <div className="shrink-0">{rightSlot}</div>
        )}
      </header>
      <div>{children}</div>
    </section>
  )
}
