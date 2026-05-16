import { cn } from '@/lib/utils'

type SectionTone = 'neutral' | 'celebratory' | 'attention'

interface InsightsSectionProps {
  /** Kanji ornament rendered at the section head, e.g. 進 / 弱 / 次. */
  kanji:        string
  /** Small-caps mono label after the kanji. */
  label:        string
  /** Optional right-aligned status label ('On track', 'Worth attention'). */
  tone?:        SectionTone
  /** Optional descriptive prose under the title. */
  description?: string
  children:     React.ReactNode
}

const TONE_LABEL: Record<Exclude<SectionTone, 'neutral'>, string> = {
  celebratory: 'On track',
  attention:   'Worth attention',
}

const TONE_DOT: Record<Exclude<SectionTone, 'neutral'>, string> = {
  celebratory: 'bg-inari-vermillion',
  attention:   'bg-jlpt-beyond-amber-warn',
}

const TONE_TEXT: Record<Exclude<SectionTone, 'neutral'>, string> = {
  celebratory: 'text-inari-vermillion-deep',
  attention:   'text-jlpt-beyond-amber-warn',
}

export function InsightsSection({
  kanji,
  label,
  tone = 'neutral',
  description,
  children,
}: InsightsSectionProps): React.JSX.Element {
  const ariaId = `insights-section-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={ariaId} className="py-8 first:pt-2 lg:py-10">
      <header className="mb-5">
        <div className="flex min-w-0 flex-col gap-y-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4 sm:gap-y-0">
          <h2 id={ariaId} className="flex min-w-0 flex-wrap items-baseline gap-3">
            <span
              lang="ja"
              aria-hidden="true"
              className="shrink-0 whitespace-nowrap font-display text-xl leading-none text-inari-vermillion translate-y-[0.05em] select-none"
            >
              {kanji}
            </span>
            <span className="min-w-0 break-words font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80">
              {label}
            </span>
          </h2>
          {tone !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em]',
                TONE_TEXT[tone],
              )}
            >
              <span
                aria-hidden="true"
                className={cn('inline-block h-1.5 w-1.5 rounded-full', TONE_DOT[tone])}
              />
              {TONE_LABEL[tone]}
            </span>
          )}
        </div>
        <hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />
        {description !== undefined && (
          <p className="mt-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-sumi-ink/90">
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  )
}
