'use client'

import Link from 'next/link'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { Logo } from '@/components/ui/Logo'
import { StatusPill } from '@/components/ui/Pill'

import {
  formatCompactCount,
  formatExactCount,
} from '@/app/(app)/today/_components/today-format'
import { SkeletonBlock } from '@/app/(app)/today/_components/section-primitives'

import { pluralizeCards } from './staging-format'

export type BriefingState =
  | 'default'
  | 'all-clear'
  | 'first-time'
  | 'backlog'
  | 'paused'
  | 'error'
  | 'loading'

export interface StagingBriefingProps {
  state:           BriefingState
  totalDue:        number
  newCount:        number
  reviewCount:     number
  backlogCount:    number
  bodyCopy:        string
  kickerKanji:     string
  kickerLabel:     string
  /** Editorial metadata row rendered above the kicker. Empty by design when
   *  there's nothing meaningful to surface. */
  metadataRow?:    React.ReactNode
  onBegin:         () => void
  onSecondary?:    (() => void) | undefined
  secondaryLabel?: string | undefined
  secondaryHref?:  string | undefined
  beginDisabled?:  boolean | undefined
}

/**
 * Card 1 in the v2 staging layout. Sits at lg:col-span-8 on top. Holds the
 * editorial briefing — metadata row, kicker, count headline, body subhead,
 * fact chips, and the single Primary action for the page (Begin reviews).
 *
 * Layout is intentionally vertical: the button sits at the bottom of the
 * card, not on the right. This keeps Card 1 reading as a single editorial
 * column rather than a two-column header-with-CTA pattern.
 */
export function StagingBriefing(props: StagingBriefingProps): React.JSX.Element {
  const { state, metadataRow } = props
  const isError   = state === 'error'
  const isLoading = state === 'loading'
  const showLogo  = state === 'all-clear' || state === 'first-time'

  return (
    <section
      aria-label="Today's review briefing"
      aria-busy={isLoading ? true : undefined}
      className={[
        'relative overflow-hidden rounded-[2px]',
        isError
          ? 'border border-error/25 bg-error-tint/20'
          : 'border border-soft-hairline bg-warm-paper-raised',
        'px-5 py-6 sm:px-7 sm:py-7 lg:px-9 lg:py-8',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute inset-x-0 top-0 z-10 h-[2px]',
          isError ? 'bg-error' : 'bg-inari-vermillion',
        ].join(' ')}
      />

      {/* Quiet 友 watermark on most states. Tomo as identity, not as illustration. */}
      {!isError && !isLoading && (
        <span
          lang="ja"
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-[8rem] leading-none text-inari-vermillion/[0.045] sm:block lg:right-8"
        >
          友
        </span>
      )}

      <div className="relative z-10">
        {!isError && !isLoading && metadataRow !== undefined && metadataRow}

        {isLoading ? (
          <LoadingContent />
        ) : isError ? (
          <ErrorContent {...props} />
        ) : (
          <DefaultContent {...props} showLogo={showLogo} />
        )}
      </div>
    </section>
  )
}

function DefaultContent({
  state,
  totalDue,
  newCount,
  reviewCount,
  backlogCount,
  bodyCopy,
  kickerKanji,
  kickerLabel,
  onBegin,
  onSecondary,
  secondaryLabel,
  secondaryHref,
  beginDisabled,
  showLogo,
}: StagingBriefingProps & { showLogo: boolean }): React.JSX.Element {
  const isCaughtUp  = state === 'all-clear'
  const isFirstTime = state === 'first-time'
  const headline    = isCaughtUp
    ? 'Caught up.'
    : isFirstTime
      ? 'Choose a deck to begin.'
      : `${formatExactCount(totalDue)} ${pluralizeCards(totalDue)} ${totalDue === 1 ? 'is' : 'are'} due`

  const headlineSize = isCaughtUp || isFirstTime
    ? 'text-[2.15rem] sm:text-[2.65rem] lg:text-[3rem]'
    : 'text-[2.4rem] sm:text-[3rem] lg:text-[3.4rem]'

  return (
    <>
      <BriefingKicker kanji={kickerKanji} label={kickerLabel} />

      {showLogo ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Logo size={64} showWordmark={false} />
          <h2
            id="review-briefing-headline"
            className={[
              'min-w-0 break-words font-display font-medium leading-[1] text-sumi-ink',
              headlineSize,
            ].join(' ')}
          >
            {headline}
            {isCaughtUp && (
              <span className="block text-faded-sumi font-normal">Enjoy your morning.</span>
            )}
          </h2>
        </div>
      ) : (
        <h2
          id="review-briefing-headline"
          className={[
            'mt-5 max-w-[18ch] break-words font-display font-medium leading-[1.02] text-sumi-ink text-balance',
            headlineSize,
          ].join(' ')}
        >
          {headline}
        </h2>
      )}

      <p className="mt-4 max-w-[58ch] break-words text-base leading-relaxed text-faded-sumi">
        {bodyCopy}
      </p>

      {state !== 'first-time' && state !== 'all-clear' && (
        <QueueFactChips
          newCount={newCount}
          reviewCount={reviewCount}
          backlogCount={backlogCount}
        />
      )}

      <PrimaryRow
        state={state}
        onBegin={onBegin}
        beginDisabled={beginDisabled ?? totalDue === 0}
        onSecondary={onSecondary}
        secondaryLabel={secondaryLabel}
        secondaryHref={secondaryHref}
      />
    </>
  )
}

function ErrorContent({
  onSecondary,
  secondaryLabel,
}: StagingBriefingProps): React.JSX.Element {
  return (
    <>
      <BriefingKicker kanji="断" label="Connection interrupted" tone="error" />
      <div className="mt-5">
        <StatusPill status="danger" label="Error" size="md" />
      </div>
      <h2
        id="review-briefing-headline"
        className="mt-4 max-w-[18ch] break-words font-display text-[2.15rem] sm:text-[2.55rem] lg:text-[2.9rem] leading-[1.05] text-error-deep"
      >
        Queue did not load.
      </h2>
      <p className="mt-5 max-w-[54ch] break-words text-base leading-relaxed text-faded-sumi">
        The review queue could not be reached. Your decks are unchanged; refresh when the connection is back.
      </p>
      <div className="mt-7">
        <ErrorAction onClick={onSecondary} label={secondaryLabel ?? 'Refresh route'} />
      </div>
    </>
  )
}

function LoadingContent(): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <SkeletonBlock width={32} height={28} className="rounded-[2px]" />
        <SkeletonBlock width={132} height={14} />
      </div>
      <hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />
      <SkeletonBlock width="min(440px, 92%)" height={48} className="mt-6 rounded-[4px]" />
      <SkeletonBlock width="min(520px, 100%)" height={18} className="mt-5 rounded-[4px]" />
      <div className="mt-6 flex flex-wrap gap-2">
        {[110, 124, 100].map((w, i) => (
          <SkeletonBlock key={i} width={w} height={28} className="rounded-full" />
        ))}
      </div>
      <SkeletonBlock width={210} height={48} className="mt-7 rounded-[2px]" />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function BriefingKicker({
  kanji,
  label,
  tone = 'default',
}: {
  kanji: string
  label: string
  tone?: 'default' | 'error'
}): React.JSX.Element {
  const isError = tone === 'error'
  return (
    <header>
      <p className="flex items-baseline gap-3.5">
        <span
          lang="ja"
          aria-hidden="true"
          className={[
            'select-none font-display text-2xl leading-none',
            isError ? 'text-error' : 'text-inari-vermillion',
          ].join(' ')}
        >
          {kanji}
        </span>
        <span
          className={[
            'font-mono text-sm font-medium uppercase tracking-normal',
            isError ? 'text-error-deep/85' : 'text-sumi-ink/80',
          ].join(' ')}
        >
          {label}
        </span>
      </p>
      <hr
        aria-hidden="true"
        className={[
          'mt-3.5 border-0 border-t',
          isError ? 'border-error/25' : 'border-soft-hairline',
        ].join(' ')}
      />
    </header>
  )
}

function QueueFactChips({
  newCount,
  reviewCount,
  backlogCount,
}: {
  newCount:     number
  reviewCount:  number
  backlogCount: number
}): React.JSX.Element {
  type Tone = 'neutral' | 'new' | 'review' | 'backlog'
  const facts: { key: string; label: string; tone: Tone }[] = [
    {
      key:   'new',
      label: `${formatCompactCount(newCount)} new`,
      tone:  newCount > 0 ? 'new' : 'neutral',
    },
    {
      key:   'review',
      label: `${formatCompactCount(reviewCount)} review`,
      tone:  reviewCount > 0 ? 'review' : 'neutral',
    },
    ...(backlogCount > 0
      ? [{ key: 'backlog', label: `${formatCompactCount(backlogCount)} overdue`, tone: 'backlog' as Tone }]
      : []),
  ]

  return (
    <div
      aria-label="Today's queue mix"
      className="mt-5 flex flex-wrap gap-2 opacity-90"
    >
      {facts.map((fact) => (
        <span
          key={fact.key}
          className={[
            'inline-flex min-h-9 items-center rounded-full border px-3',
            'font-mono text-[0.6875rem] tabular-nums tracking-normal',
            FACT_TONE_CLASSES[fact.tone],
          ].join(' ')}
        >
          {fact.label}
        </span>
      ))}
    </div>
  )
}

const FACT_TONE_CLASSES: Record<'neutral' | 'new' | 'review' | 'backlog', string> = {
  neutral: 'border-soft-hairline/80 bg-warm-paper-raised/70 text-faded-sumi',
  new:     'border-queue-new-mark/18 bg-queue-new-wash/55 text-queue-new-mark/85',
  review:  'border-queue-review-mark/18 bg-queue-review-wash/55 text-queue-review-mark/85',
  backlog: 'border-error-deep/20 bg-error-tint/28 text-error-deep/85',
}

function PrimaryRow({
  state,
  onBegin,
  beginDisabled,
  onSecondary,
  secondaryLabel,
  secondaryHref,
}: {
  state:           BriefingState
  onBegin:         () => void
  beginDisabled:   boolean
  onSecondary?:    (() => void) | undefined
  secondaryLabel?: string | undefined
  secondaryHref?:  string | undefined
}): React.JSX.Element {
  const _reducedMotion = false
  const isCaughtUp    = state === 'all-clear'
  const isFirstTime   = state === 'first-time'

  return (
    <div
      className="mt-7 flex flex-wrap items-center gap-3"    >
      {isFirstTime ? (
        <PrimaryLink href={secondaryHref ?? '/decks'} label={secondaryLabel ?? 'Browse decks'} />
      ) : isCaughtUp ? (
        <SecondaryButton onClick={onSecondary ?? (() => undefined)} label={secondaryLabel ?? 'Study ahead'} />
      ) : (
        <PrimaryButton onClick={onBegin} disabled={beginDisabled} label="Begin reviews" />
      )}
    </div>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  label,
}: {
  onClick:  () => void
  disabled: boolean
  label:    string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex min-h-14 min-w-[240px] max-w-full flex-wrap items-center justify-center gap-2.5 rounded-[2px] px-8 py-3',
        'bg-inari-vermillion-deep text-base font-semibold text-warm-paper-raised',
        'transition-[transform,background-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:bg-inari-vermillion active:translate-y-0 active:shadow-[inset_0_1px_2px_rgba(31,26,24,0.18)]',
        'disabled:pointer-events-none disabled:opacity-60',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
      ].join(' ')}
    >
      {label}
      <ArrowGlyph direction="right" />
    </button>
  )
}

function SecondaryButton({
  onClick,
  label,
}: {
  onClick: () => void
  label:   string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-h-14 min-w-[220px] max-w-full flex-wrap items-center justify-center gap-2.5 rounded-[2px] px-8 py-3',
        'border border-soft-hairline bg-warm-paper-raised text-base font-medium text-sumi-ink',
        'transition-[transform,background-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-faded-sumi hover:bg-cream-inset active:translate-y-0',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
      ].join(' ')}
    >
      {label}
      <ArrowGlyph direction="right" />
    </button>
  )
}

function PrimaryLink({
  href,
  label,
}: {
  href:  string
  label: string
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className={[
        'inline-flex min-h-14 min-w-[240px] max-w-full flex-wrap items-center justify-center gap-2.5 rounded-[2px] px-8 py-3',
        'bg-inari-vermillion-deep text-base font-semibold text-warm-paper-raised',
        'transition-[transform,background-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:bg-inari-vermillion active:translate-y-0',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
      ].join(' ')}
    >
      {label}
      <ArrowGlyph direction="right" />
    </Link>
  )
}

function ErrorAction({
  onClick,
  label,
}: {
  onClick?: (() => void) | undefined
  label:    string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-h-14 min-w-[200px] max-w-full flex-wrap items-center justify-center gap-2.5 rounded-[2px] px-8 py-3',
        'bg-error text-base font-medium text-warm-paper-raised',
        'transition-[transform,background-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:bg-error-deep active:translate-y-0',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-error-deep',
      ].join(' ')}
    >
      {label}
      <ArrowGlyph direction="right" />
    </button>
  )
}
