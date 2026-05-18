'use client'

// Reusable visuals for Today modules: card chrome, empty/error states,
// skeletons, and decorative preview art.
//
// File map:
//   Exported: CardHeader → SkeletonBlock → EmptyState → UnavailableState →
//             ConnectionErrorNotice.
//   Internal: PreviewStage and tone tokens → visual previews (Shelf, Forecast,
//             Focus, WeakSpots, Recent) → NoticeFrame → ErrorSignalPreview.

import { StatusPill } from '@/components/ui/Pill'
import { QuietLink } from '@/components/ui/QuietLink'

import { formatExactCount } from './today-format'

// Re-export for in-folder callers (today, staging) that already import from here.
export { Skeleton as SkeletonBlock } from '@/components/ui/Skeleton'

// ── CardHeader (kanji ornament + small-caps mono + right action + rule) ──────

interface CardHeaderProps {
  /**
   * DOM id rendered on the inner <h2>. Pair with `aria-labelledby` on the
   * <section> wrapper so screen readers announce the section by its kanji
   * label. Required for any carded section that uses aria-labelledby.
   */
  id?: string
  /** Single kanji or 2-char compound. Rendered at text-xl in all cases. */
  kanji:    string
  /** Small-caps mono label rendered after the kanji. */
  label:    string
  /** Optional count rendered after the label as " · {n}". */
  count?:   number
  /** Optional context line rendered below the label in richer module headers. */
  description?: string
  /** Optional right-aligned content. Interactive children own their target size. */
  rightContent?: React.ReactNode
  /**
   * Archetype rhythm. Keeps the kanji header vocabulary intact while letting
   * chart/list/progress modules avoid identical spacing. Kanji size is now
   * fixed at text-xl regardless of variant; this prop only affects margins.
   */
  variant?: 'default' | 'compact' | 'chart'
}

export function CardHeader({
  id,
  kanji,
  label,
  count,
  description,
  rightContent,
  variant = 'default',
}: CardHeaderProps): React.JSX.Element {
  // Kanji ornament always renders at text-xl. Earlier iterations varied size
  // by variant + compound length; that was retired in favor of one
  // consistent ornament across all surfaces (dashboard, profile, settings).
  const kanjiSizeClass = 'text-xl'
  const hasDescription = description !== undefined
  const headerMargin = hasDescription ? 'mb-5' :
    variant === 'chart'    ? 'mb-3' :
    variant === 'compact'  ? 'mb-4' :
                              'mb-5'
  const title = (
    <h2 id={id} className={`flex min-w-0 flex-wrap items-baseline gap-3`}>
      <span
        lang="ja"
        aria-hidden="true"
        className={`shrink-0 whitespace-nowrap font-display ${kanjiSizeClass} text-inari-vermillion leading-none translate-y-[0.05em] select-none`}
      >
        {kanji}
      </span>
      <span className="min-w-0 break-words font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80">
        {label}
        {count !== undefined && (
          <span className="ml-1.5 text-faded-sumi">· {formatExactCount(count)}</span>
        )}
      </span>
    </h2>
  )

  return (
    <header className={headerMargin}>
      {hasDescription ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:content-center">
          <div className="min-w-0">
            {title}
            <p className="mt-2 max-w-[58ch] break-words text-[0.8125rem] leading-[1.55] text-faded-sumi">
              {description}
            </p>
          </div>
          {rightContent !== undefined && (
            <div className="min-w-0 shrink-0 -my-2 py-2 font-mono text-xs text-faded-sumi tracking-wide sm:justify-self-end">
              {rightContent}
            </div>
          )}
        </div>
      ) : (
        // Stacks below sm so a wide rightContent (e.g. "See the next two
        // weeks →") doesn't pinch the title on phones; flips to a single
        // baseline-aligned row at sm+. Mirrors the with-description grid's
        // responsive shape so both CardHeader paths feel identical at the
        // viewport boundary.
        <div className="flex min-w-0 flex-col gap-y-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4 sm:gap-y-0">
          {title}
          {rightContent !== undefined && (
            // The slot preserves header rhythm; interactive children own their
            // actual target size.
            <div className="min-w-0 shrink-0 -my-2 py-2 font-mono text-xs text-faded-sumi tracking-wide">
              {rightContent}
            </div>
          )}
        </div>
      )}
      <hr
        aria-hidden="true"
        className={[
          'border-0 border-t border-soft-hairline',
          variant === 'chart' ? 'mt-2.5' : 'mt-3',
        ].join(' ')}
      />
    </header>
  )
}

export const CHART_MODULE_CHROME = [
  'relative overflow-hidden bg-warm-paper-raised',
  'border border-soft-hairline rounded-[2px]',
  'px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7',
].join(' ')

export const LIST_MODULE_CHROME = [
  'h-full bg-warm-paper-raised',
  'border border-soft-hairline rounded-[2px]',
  'px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7',
].join(' ')

// ── Empty and notice atoms ───────────────────────────────────────────────────

interface EmptyStateAction {
  href:       string
  label:      string
  ariaLabel?: string
}

type EmptyStateVisual = 'shelf' | 'forecast' | 'focus' | 'weak-spots' | 'recent'
type ErrorStateVisual = EmptyStateVisual | 'connection'

interface EmptyStateProps {
  title:             string
  body:              string
  action?:           EmptyStateAction
  visual?:           EmptyStateVisual
  preview?:          React.ReactNode | null
  previewAriaLabel?: string
  className?:        string
  contentClassName?: string
}

export function EmptyState({
  title,
  body,
  action,
  visual,
  preview,
  previewAriaLabel,
  className = '',
  contentClassName = '',
}: EmptyStateProps): React.JSX.Element {
  const resolvedPreview = preview !== undefined ? preview : (
    visual !== undefined ? <EmptyStatePreview visual={visual} /> : undefined
  )
  const previewA11yProps = previewAriaLabel === undefined
    ? { 'aria-hidden': true }
    : { 'aria-label': previewAriaLabel }

  return (
    <div className={`min-w-0 py-6 ${className}`}>
      <div className="grid w-full min-w-0 gap-5">
        <div className={`min-w-0 w-full ${contentClassName}`}>
          <p className="break-words font-display text-lg leading-tight text-sumi-ink">
            {title}
          </p>
          <p className="mt-2 max-w-[58ch] break-words text-sm leading-relaxed text-faded-sumi">
            {body}
          </p>
          {action !== undefined && (
            <div className="mt-4">
              <QuietLink
                href={action.href}
                tone="brand"
                trailingArrow
                {...(action.ariaLabel !== undefined ? { ariaLabel: action.ariaLabel } : {})}
              >
                {action.label}
              </QuietLink>
            </div>
          )}
        </div>

        {resolvedPreview !== undefined && resolvedPreview !== null && (
          <div className="min-w-0 w-full" {...previewA11yProps}>
            {resolvedPreview}
          </div>
        )}
      </div>
    </div>
  )
}

export function UnavailableState({
  title,
  body,
  action,
  preview,
  previewAriaLabel,
  className = '',
  contentClassName = '',
}: EmptyStateProps): React.JSX.Element {
  const resolvedPreview = preview === undefined ? null : preview

  return (
    <EmptyState
      title={title}
      body={body}
      className={className}
      contentClassName={contentClassName}
      {...(action !== undefined ? { action } : {})}
      preview={resolvedPreview}
      {...(previewAriaLabel !== undefined ? { previewAriaLabel } : {})}
    />
  )
}

function EmptyStatePreview({ visual }: { visual: EmptyStateVisual }): React.JSX.Element {
  switch (visual) {
    case 'shelf':
      return <ShelfPreview />
    case 'forecast':
      return <ForecastPreview />
    case 'focus':
      return <FocusPreview />
    case 'weak-spots':
      return <WeakSpotsPreview />
    case 'recent':
      return <RecentPreview />
  }
}

function PreviewStage({
  children,
  className = '',
  tone = 'neutral',
}: {
  children:  React.ReactNode
  className?: string
  tone?:     PreviewTone
}): React.JSX.Element {
  const toneClass = PREVIEW_TONE_CLASSES[tone]

  return (
    <div
      className={[
        'today-empty-preview-stage relative min-h-[7.25rem] w-full overflow-hidden rounded-[2px]',
        toneClass.frame,
        'px-4 py-3 sm:px-5',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" className={`absolute inset-x-4 top-4 h-px ${toneClass.topRule}`} />
      <span aria-hidden="true" className={`absolute inset-x-6 bottom-4 h-px ${toneClass.bottomRule}`} />
      {children}
    </div>
  )
}

type PreviewTone = 'neutral' | 'shelf' | 'forecast' | 'focus' | 'weak' | 'recent'

const PREVIEW_TONE_CLASSES: Record<PreviewTone, {
  frame:      string
  topRule:    string
  bottomRule: string
}> = {
  neutral: {
    frame:      'border border-soft-hairline/70 bg-cream-inset/35',
    topRule:    'bg-soft-hairline/80',
    bottomRule: 'bg-soft-hairline/70',
  },
  shelf: {
    frame:      'border border-inari-vermillion/12 bg-cream-inset/45',
    topRule:    'bg-inari-vermillion/18',
    bottomRule: 'bg-aizome-indigo/12',
  },
  forecast: {
    frame:      'border border-aizome-indigo/12 bg-cream-inset/45',
    topRule:    'bg-aizome-indigo/18',
    bottomRule: 'bg-inari-vermillion/12',
  },
  focus: {
    frame:      'border border-inari-vermillion/14 bg-cream-inset/45',
    topRule:    'bg-inari-vermillion/20',
    bottomRule: 'bg-inari-vermillion/14',
  },
  weak: {
    frame:      'border border-error/14 bg-error-tint/16',
    topRule:    'bg-error/18',
    bottomRule: 'bg-inari-vermillion/12',
  },
  recent: {
    frame:      'border border-aizome-indigo/12 bg-cream-inset/45',
    topRule:    'bg-aizome-indigo/18',
    bottomRule: 'bg-inari-vermillion/12',
  },
}

function ShelfPreview(): React.JSX.Element {
  const cards = [
    {
      label: '語',
      className: '-rotate-2 border-inari-vermillion/20 bg-warm-paper-raised/95 text-inari-vermillion',
      delay: '0ms',
    },
    {
      label: '漢',
      className: 'translate-y-[-0.25rem] border-inari-vermillion/28 bg-vermillion-wash/55 text-inari-vermillion-deep',
      delay: '40ms',
    },
    {
      label: '文',
      className: 'rotate-2 border-aizome-indigo/18 bg-cream-inset/75 text-aizome-indigo',
      delay: '80ms',
    },
  ]

  return (
    <PreviewStage tone="shelf">
      <div className="relative z-10 flex h-24 items-end justify-center gap-[clamp(0.45rem,3.5vw,1.25rem)] pt-3">
        {cards.map((card) => (
          <span
            key={card.label}
            className={[
              'flex h-[4.75rem] w-[clamp(2.75rem,10vw,3.75rem)] items-center justify-center rounded-[2px]',
              'today-empty-preview-card border font-display text-xl leading-none',
              card.className,
            ].join(' ')}
            style={{ transitionDelay: card.delay }}
          >
            <span lang="ja" className="today-empty-preview-glyph">
              {card.label}
            </span>
          </span>
        ))}
      </div>
      <span aria-hidden="true" className="absolute bottom-8 left-8 right-8 h-[2px] bg-aizome-indigo/12" />
    </PreviewStage>
  )
}

function ForecastPreview(): React.JSX.Element {
  const bars = [
    'dashboard-preview-forecast-bar-0',
    'dashboard-preview-forecast-bar-1',
    'dashboard-preview-forecast-bar-2',
    'dashboard-preview-forecast-bar-3',
    'dashboard-preview-forecast-bar-4',
    'dashboard-preview-forecast-bar-5',
    'dashboard-preview-forecast-bar-6',
    'dashboard-preview-forecast-bar-7',
    'dashboard-preview-forecast-bar-8',
    'dashboard-preview-forecast-bar-9',
    'dashboard-preview-forecast-bar-10',
    'dashboard-preview-forecast-bar-11',
    'dashboard-preview-forecast-bar-12',
    'dashboard-preview-forecast-bar-13',
  ]

  return (
    <PreviewStage tone="forecast">
      <div className="relative z-10 flex h-20 items-end gap-1.5 pt-3">
        {bars.map((bar, index) => (
          <span
            key={index}
            className={`today-empty-preview-meter flex-1 rounded-t-[1px] ${bar}`}
            style={{ transitionDelay: `${index * 8}ms` }}
          />
        ))}
      </div>
      <div className="relative z-10 mt-3 grid grid-cols-7 gap-1.5">
        {['今', '火', '水', '木', '金', '土', '日'].map((label, index) => (
          <span
            key={label}
            lang="ja"
            className={[
              'text-center font-mono text-[0.625rem] leading-none',
              index === 0 ? 'text-inari-vermillion' : 'text-faded-sumi',
            ].join(' ')}
          >
            {label}
          </span>
        ))}
      </div>
    </PreviewStage>
  )
}

function FocusPreview(): React.JSX.Element {
  return (
    <PreviewStage tone="focus">
      <span
        lang="ja"
        aria-hidden="true"
        className="today-empty-preview-accent absolute right-4 top-3 select-none font-display text-[3.75rem] leading-none text-inari-vermillion/[0.09]"
      >
        要
      </span>
      <div className="relative z-10 pt-4">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
          pattern to watch
        </p>
        <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
          <span lang="ja" className="font-display text-2xl leading-none text-sumi-ink/85">
            払う
          </span>
          <span lang="ja" className="font-mono text-xs tracking-wide text-inari-vermillion/80">
            はらう
          </span>
        </div>
        <div className="mt-5 space-y-2.5">
          <span className="block h-1.5 w-11/12 rounded-[1px] bg-soft-hairline/80" />
          <span className="today-empty-preview-accent block h-1.5 w-7/12 rounded-[1px] bg-inari-vermillion/[0.16]" />
          <span className="today-empty-preview-accent block h-1.5 w-9/12 rounded-[1px] bg-inari-vermillion/[0.28] [transition-delay:40ms]" />
        </div>
      </div>
    </PreviewStage>
  )
}

function WeakSpotsPreview(): React.JSX.Element {
  const leechCards = [
    {
      word:      '必要',
      misses:    'Missed 8x',
      className: 'left-1/2 top-8 z-0 -translate-x-[8.9rem] -rotate-[9deg] border-error/16 bg-error-tint/30 text-faded-sumi',
      label:     'WeakSpot',
      marker:    'bg-error/42',
    },
    {
      word:      '違う',
      misses:    'Missed 9x',
      className: 'left-1/2 top-3 z-20 -translate-x-1/2 border-error/24 bg-error-tint/58 text-sumi-ink',
      label:     'WeakSpot',
      marker:    'bg-error/72',
    },
    {
      word:      '続ける',
      misses:    'Missed 7x',
      className: 'left-1/2 top-8 z-10 translate-x-[3.75rem] rotate-[9deg] border-error/18 bg-error-tint/38 text-faded-sumi',
      label:     'WeakSpot',
      marker:    'bg-error/52',
    },
  ]

  return (
    <PreviewStage tone="weak" className="min-h-[10.75rem]">
      <div className="relative z-10 mx-auto h-[10.5rem] max-w-[20.5rem] pt-1">
        {leechCards.map((card) => (
          <div
            key={card.word}
            aria-hidden="true"
            className={[
              'absolute h-[7.45rem] w-[5.35rem] rounded-[2px] border',
              card.className,
            ].join(' ')}
          >
            <span className={`today-empty-preview-accent absolute inset-x-0 top-0 h-[2px] ${card.marker}`} />
            <span className="absolute left-3 top-3 font-mono text-[0.625rem] font-medium uppercase tracking-[0.08em] text-faded-sumi">
              {card.label}
            </span>
            <div className="absolute inset-x-3 top-[3.15rem] flex items-center justify-center">
              <span lang="ja" className="whitespace-nowrap font-display text-lg leading-none text-sumi-ink">
                {card.word}
              </span>
            </div>
            <span className="absolute bottom-3 left-3 right-3 text-center font-mono text-[0.625rem] font-medium uppercase tracking-[0.06em] text-inari-vermillion-deep">
              <span className="today-empty-preview-glyph inline-block">
                {card.misses}
              </span>
            </span>
          </div>
        ))}
      </div>
    </PreviewStage>
  )
}

function RecentPreview(): React.JSX.Element {
  const days = [
    { label: '月', size: 'h-7',  tone: 'bg-aizome-indigo/28' },
    { label: '火', size: 'h-10', tone: 'bg-aizome-indigo/36' },
    { label: '水', size: 'h-3',  tone: 'bg-soft-hairline' },
    { label: '木', size: 'h-12', tone: 'bg-inari-vermillion/42' },
    { label: '金', size: 'h-8',  tone: 'bg-aizome-indigo/30' },
    { label: '土', size: 'h-3',  tone: 'bg-soft-hairline' },
    { label: '今', size: 'h-11', tone: 'bg-inari-vermillion/48' },
  ]

  return (
    <PreviewStage tone="recent">
      <div className="relative z-10 grid h-20 grid-cols-7 items-end gap-2 pt-3">
        {days.map((day, index) => (
          <span key={day.label} className="flex min-w-0 flex-col items-center gap-2">
            <span
              className={[
                'w-full max-w-12 rounded-t-[1px]',
                'today-empty-preview-meter origin-bottom',
                day.tone,
                day.size,
              ].join(' ')}
              style={{ transitionDelay: `${index * 12}ms` }}
            />
            <span
              lang="ja"
              className={[
                'font-mono text-[0.625rem] leading-none',
                day.label === '今' ? 'text-inari-vermillion' : 'text-faded-sumi',
              ].join(' ')}
            >
              {day.label}
            </span>
          </span>
        ))}
      </div>
    </PreviewStage>
  )
}

interface NoticeFrameProps {
  title?:         string | undefined
  message?:       string | undefined
  body?:          string | undefined
  retryHref?:     string | undefined
  refreshLabel?:  string | undefined
  staleFallback?: string | undefined
  visual?:        ErrorStateVisual | null | undefined
  className?:     string | undefined
}

interface NoticeContent {
  label:      string
  title:      string
  body:       string
}

const CONNECTION_NOTICE: NoticeContent = {
  label:      'Connection',
  title:      'Connection issue',
  body:       'This section did not load. Check your connection, then refresh.',
}

function ErrorSignalPreview({ visual }: { visual: ErrorStateVisual }): React.JSX.Element {
  switch (visual) {
    case 'shelf':
      return (
        <ErrorPreviewStage label="shelf paused">
          <div className="relative z-10 flex h-20 items-end justify-center gap-2 pt-5">
            {['語', '漢', '文'].map((label, index) => (
              <span
                key={label}
                lang="ja"
                className={[
                  'flex h-14 w-12 items-center justify-center rounded-[1px] border font-display text-lg',
                  index === 1
                    ? 'translate-y-[-0.35rem] border-error/40 bg-error-tint text-error-deep'
                    : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi/70',
                ].join(' ')}
              >
                {index === 1 ? '!' : label}
              </span>
            ))}
          </div>
        </ErrorPreviewStage>
      )
    case 'forecast':
      return (
        <ErrorPreviewStage label="route gap">
          <div className="relative z-10 flex h-20 items-end gap-1.5 pt-5">
            {[26, 40, 18, 54, 24, 36, 12].map((height, index) => (
              <span
                key={index}
                className={[
                  'flex-1 origin-bottom rounded-t-[1px]',
                  index === 3 ? 'bg-error' : 'bg-error/25',
                ].join(' ')}
                style={{
                  height:  `${height}px`,
                  opacity: index > 3 ? 0.45 : 0.75,
                }}
              />
            ))}
          </div>
          <span aria-hidden="true" className="absolute left-[46%] top-8 h-10 w-px rotate-12 bg-error-deep/45" />
        </ErrorPreviewStage>
      )
    case 'focus':
      return (
        <ErrorPreviewStage label="focus waiting">
          <span
            lang="ja"
            aria-hidden="true"
            className="absolute right-4 top-3 select-none font-display text-[3.75rem] leading-none text-error/[0.10]"
          >
            要
          </span>
          <div className="relative z-10 pt-8">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-error-deep/70">
              signal unavailable
            </span>
            <div className="mt-4 space-y-2.5">
              <span className="block h-1.5 w-11/12 rounded-[1px] bg-error/20" />
              <span className="block h-1.5 w-7/12 rounded-[1px] bg-error/20" />
              <span className="block h-1.5 w-9/12 rounded-[1px] bg-error/45" />
            </div>
          </div>
        </ErrorPreviewStage>
      )
    case 'weak-spots':
      return (
        <ErrorPreviewStage label="drill paused">
          <div className="relative z-10 flex h-20 items-center justify-center gap-2 pt-5">
            {['覚', '!', '書'].map((label, index) => (
              <span
                key={`${label}-${index}`}
                lang={label === '!' ? undefined : 'ja'}
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-[1px] border font-display text-lg',
                  label === '!'
                    ? 'border-error/40 bg-error text-warm-paper-raised'
                    : 'border-error/20 bg-error-tint/45 text-error-deep/70',
                ].join(' ')}
              >
                {label}
              </span>
            ))}
          </div>
        </ErrorPreviewStage>
      )
    case 'recent':
      return (
        <ErrorPreviewStage label="history gap">
          <div className="relative z-10 grid h-20 grid-cols-7 items-end gap-2 pt-5">
            {[7, 10, 4, 12, 8, 3, 9].map((height, index) => (
              <span key={index} className="flex min-w-0 flex-col items-center gap-2">
                <span
                  className={[
                    'w-full max-w-9 rounded-t-[1px]',
                    index === 3 ? 'bg-error' : 'bg-error/25',
                  ].join(' ')}
                  style={{ height: `${height * 4}px`, opacity: index > 3 ? 0.45 : 0.7 }}
                />
                <span className={index === 3 ? 'h-1.5 w-1.5 rounded-full bg-error' : 'h-1.5 w-1.5 rounded-full bg-error/25'} />
              </span>
            ))}
          </div>
        </ErrorPreviewStage>
      )
    case 'connection':
      return (
        <ErrorPreviewStage label="retry ready">
          <div className="relative z-10 flex h-20 items-center justify-center pt-5">
            <span className="h-px w-16 bg-error/35" />
            <span className="mx-3 flex h-10 w-10 items-center justify-center rounded-[2px] border border-error/35 bg-error-tint font-mono text-sm font-semibold text-error-deep">
              !
            </span>
            <span className="h-px w-16 border-t border-dashed border-error/45" />
          </div>
        </ErrorPreviewStage>
      )
  }
}

function ErrorPreviewStage({
  children,
  label,
}: {
  children: React.ReactNode
  label:    string
}): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={[
        'dashboard-error-preview group/error relative min-h-[7.25rem] overflow-hidden rounded-[2px]',
        'border border-error/20 bg-warm-paper-raised/70 px-4 py-3',
        'today-motion-colors hover:border-error/35 hover:bg-error-tint/35',
      ].join(' ')}
    >
      <span className="today-motion-colors absolute inset-x-4 top-4 h-px bg-error/25 group-hover/error:bg-error/35" />
      <span className="today-motion-colors absolute inset-x-6 bottom-4 h-px bg-error/20 group-hover/error:bg-error/30" />
      <span className="today-motion-preview absolute left-4 top-5 flex h-5 w-5 items-center justify-center rounded-full border border-error/35 bg-error-tint font-mono text-[0.625rem] font-semibold text-error-deep group-hover/error:-translate-y-0.5 group-hover/error:border-error/50">
        !
      </span>
      <span className="today-motion-preview absolute right-4 top-5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-error-deep/65 group-hover/error:text-error-deep">
        {label}
      </span>
      {children}
    </div>
  )
}

function NoticeFrame({
  content,
  title,
  message,
  body,
  retryHref = '?retry=now',
  refreshLabel = 'Refresh',
  staleFallback,
  visual = null,
  className = '',
}: NoticeFrameProps & { content: NoticeContent }): React.JSX.Element {
  const hasVisual = visual !== null && visual !== undefined

  return (
    <div
      role="alert"
      className={[
        'w-full min-w-0 rounded-[2px] border border-error/25 bg-error-tint/35 p-4 sm:p-5',
        className,
      ].join(' ')}
    >
      <div
        className={[
          'grid gap-4 sm:items-center',
          hasVisual ? 'sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.72fr)]' : '',
        ].join(' ')}
      >
        <div className="min-w-0">
          <StatusPill status="danger" label={content.label} size="sm" />

          <p className="mt-3 break-words text-sm font-semibold leading-relaxed text-error-deep">
            {title ?? content.title}
          </p>
          <p className="mt-1.5 max-w-[58ch] break-words text-sm leading-relaxed text-sumi-ink/80">
            {message ?? body ?? content.body}
          </p>
          {staleFallback !== undefined && (
            <p className="mt-2 break-words font-mono text-xs leading-relaxed tracking-wide text-error-deep/80">
              {staleFallback}
            </p>
          )}
          <div className="mt-4">
            <QuietLink href={retryHref} tone="error" trailingArrow>
              {refreshLabel}
            </QuietLink>
          </div>
        </div>

        {visual !== null && visual !== undefined && <ErrorSignalPreview visual={visual} />}
      </div>
    </div>
  )
}

export interface ConnectionErrorNoticeProps extends NoticeFrameProps {
  sectionName?: string
}

export function ConnectionErrorNotice({
  sectionName,
  message,
  title,
  ...props
}: ConnectionErrorNoticeProps): React.JSX.Element {
  const sectionMessage = sectionName !== undefined
    ? `${sectionName} did not load. Check your connection, then refresh.`
    : undefined

  return (
    <NoticeFrame
      {...props}
      content={CONNECTION_NOTICE}
      title={title}
      message={message ?? sectionMessage}
    />
  )
}

// ── Module state type ────────────────────────────────────────────────────────

export type ModuleState = 'default' | 'loading' | 'error' | 'unavailable'
