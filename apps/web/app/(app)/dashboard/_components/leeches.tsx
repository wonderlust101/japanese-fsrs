'use client'

import Link from 'next/link'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'

import {
  formatExactCount,
  safeNonNegativeInteger,
} from './dashboard-format'
import { DashboardRowMotion } from './dashboard-motion'
import {
  CardHeader,
  ConnectionErrorNotice,
  EmptyState,
  LIST_MODULE_CHROME,
  type ModuleState,
  SkeletonBlock,
  UnavailableState,
} from './section-primitives'

const LEECHES_CHROME = `${LIST_MODULE_CHROME} flex flex-col`
const WEAK_SPOTS_DESCRIPTION = 'Repeat misses that should move into a short drill.'

export interface Leech {
  cardId:   string
  word:     string
  reading:  string
  errors:   number
}

interface LeechesProps {
  state:    ModuleState
  leeches?: Leech[]
}

interface LeechCondition {
  label:           string
  mark:            string
  markerClassName: string
  labelClassName:  string
}

function conditionForSlips(slips: number): LeechCondition {
  if (slips >= 9) {
    return {
      label:           'Sticky',
      mark:            '!',
      markerClassName: 'border-inari-vermillion/30 bg-vermillion-wash/45 text-inari-vermillion-deep',
      labelClassName:  'text-inari-vermillion-deep',
    }
  }

  if (slips >= 7) {
    return {
      label:           'Needs drill',
      mark:            '•',
      markerClassName: 'border-jlpt-beyond-amber-warn/30 bg-jlpt-beyond-bg/45 text-jlpt-beyond-amber-warn',
      labelClassName:  'text-jlpt-beyond-amber-warn',
    }
  }

  return {
    label:           'Watch',
    mark:            '·',
    markerClassName: 'border-soft-hairline bg-warm-paper-raised text-faded-sumi',
    labelClassName:  'text-faded-sumi',
  }
}

export function Leeches({ state, leeches = [] }: LeechesProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="leeches-label" aria-busy="true" className={LEECHES_CHROME}>
        <CardHeader
          id="leeches-label"
          kanji="弱点"
          label="Weak spots"
          variant="compact"
          description={WEAK_SPOTS_DESCRIPTION}
          rightContent={<SkeletonBlock width={64} height={11} />}
        />
        <ul className="-mx-2 sm:-mx-3">
          {[...Array(3)].map((_, i) => (
            <DashboardRowMotion
              key={i}
              index={i}
              interactive={false}
              className="border-b border-soft-hairline/60 px-2 py-3 last:border-b-0 sm:px-3"
            >
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock width="50%" height={16} />
                <SkeletonBlock width={64} height={13} />
              </div>
            </DashboardRowMotion>
          ))}
        </ul>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
        <CardHeader
          id="leeches-label"
          kanji="弱点"
          label="Weak spots"
          variant="compact"
          description={WEAK_SPOTS_DESCRIPTION}
        />
        <div className="flex min-h-[10rem] items-center py-5">
          <ConnectionErrorNotice sectionName="Your weak spots" />
        </div>
      </section>
    )
  }

  if (state === 'unavailable') {
    return (
      <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
        <CardHeader
          id="leeches-label"
          kanji="弱点"
          label="Weak spots"
          variant="compact"
          description={WEAK_SPOTS_DESCRIPTION}
        />
        <UnavailableState
          title="Weak-spot tracking is not connected yet"
          body="Keep using reviews for now. This space is reserved for cards that miss repeatedly and need a focused second pass."
          action={{ href: '/review', label: "Review today's stack" }}
        />
      </section>
    )
  }

  const normalizedLeeches = leeches.map(normalizeLeech)

  if (normalizedLeeches.length === 0) {
    return (
      <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
        <CardHeader
          id="leeches-label"
          kanji="弱点"
          label="Weak spots"
          variant="compact"
          description={WEAK_SPOTS_DESCRIPTION}
        />
        <EmptyState
          title="Nothing is slipping right now"
          body="Reviews have not flagged any repeat misses. If a card starts missing again and again, it will land here for a short drill."
          action={{ href: '/review', label: "Review today's stack" }}
          visual="weak-spots"
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
      <CardHeader
        id="leeches-label"
        kanji="弱点"
        label="Weak spots"
        count={normalizedLeeches.length}
        variant="compact"
        description={WEAK_SPOTS_DESCRIPTION}
        rightContent={
          <Link
            href="/review?mode=drill"
            className="dashboard-motion-colors -mx-2 inline-flex min-h-11 items-center rounded-[2px] px-2 underline-offset-4 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45"
          >
            practice all →
          </Link>
        }
      />

      <ul className="-mx-2 sm:-mx-3">
        {normalizedLeeches.map((leech, index) => {
          const condition = conditionForSlips(leech.errors)
          const encodedCardId = encodeURIComponent(leech.cardId)
          const href = encodedCardId.length > 0
            ? `/review?mode=drill&cardId=${encodedCardId}`
            : '/review?mode=drill'
          const slipLabel = leech.errors === 1 ? 'slip' : 'slips'

          return (
            <DashboardRowMotion
              key={leech.cardId || `${leech.word}-${index}`}
              index={index}
              className="border-b border-soft-hairline/60 last:border-b-0"
            >
              <Link
                href={href}
                className="dashboard-motion-colors group grid grid-cols-1 gap-2 px-2 py-3 hover:bg-cream-inset/70 focus-visible:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-1px] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={[
                      'dashboard-motion-colors flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[0.625rem] font-semibold leading-none',
                      condition.markerClassName,
                    ].join(' ')}
                  >
                    {condition.mark}
                  </span>
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span lang="ja" className="truncate text-base font-medium text-sumi-ink">
                      {leech.word}
                    </span>
                    {leech.reading.length > 0 && (
                      <span lang="ja" className="min-w-0 truncate text-sm tracking-wide text-faded-sumi">
                        {leech.reading}
                      </span>
                    )}
                  </span>
                </span>

                <span className="flex shrink-0 items-center justify-between gap-4 pl-7 sm:justify-end sm:pl-0">
                  <span className="flex flex-col items-end gap-0.5">
                    <span
                      className={[
                        'font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.06em]',
                        condition.labelClassName,
                      ].join(' ')}
                    >
                      {condition.label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-faded-sumi">
                      {formatExactCount(leech.errors)} {slipLabel}
                    </span>
                  </span>
                  <span className="dashboard-motion-transform text-faded-sumi group-hover:translate-x-0.5 group-hover:text-sumi-ink">
                    <ArrowGlyph direction="right" />
                  </span>
                </span>
              </Link>
            </DashboardRowMotion>
          )
        })}
      </ul>
    </section>
  )
}

function normalizeLeech(leech: Leech): Leech {
  return {
    ...leech,
    cardId:  leech.cardId.trim(),
    word:    leech.word.trim() || 'Unknown card',
    reading: leech.reading.trim(),
    errors:  safeNonNegativeInteger(leech.errors),
  }
}
