'use client'

import Link from 'next/link'

import { SectionCard } from '@/components/ui/SectionCard'
import { QuietLink } from '@/components/ui/QuietLink'
import { FuriganaText } from '@/components/ui/FuriganaText'
import { Pill, type JlptPillLevel } from '@/components/ui/Pill'
import { useWeakSpotsQuery } from '@/lib/api/weak-spots'
import type { ApiWeakSpotListItem } from '@fsrs-japanese/shared-types'

const PREVIEW_LIMIT = 2

/**
 * Today's "concise pre-session note (weak-point reminder)" per the IA
 * (`docs/information_architecture/01_today.md`). Shows the learner's top
 * unresolved weak spots so they can decide whether to engage with a drill
 * before starting their daily review.
 *
 * Deliberately minimal: a count, 1–2 preview rows, two CTAs. The full
 * weak-spot vocabulary (diagnosis, prescription, per-row actions) lives
 * one click away at `/insights/weak-spots`; Today is readiness, not
 * analysis, per the IA's anti-pattern list.
 *
 * Renders nothing while loading, on error, or when the learner has no
 * unresolved weak spots — Today should stay calm; absence reads as the
 * positive signal. The sidebar's separate `useUnresolvedWeakSpotCount`
 * already surfaces the wider health signal through its count badge.
 */
export function TodayWeakSpotsCard(): React.JSX.Element | null {
  // Fetch one more than we display so we can decide whether to surface
  // the "See all" link (which would otherwise feel redundant when the
  // preview already shows everything).
  const query = useWeakSpotsQuery({
    status: 'unresolved',
    limit:  PREVIEW_LIMIT + 1,
    sort:   'mostRecent',
  })

  if (query.isLoading || query.isError) return null
  const items = query.data?.items ?? []
  if (items.length === 0) return null

  const preview     = items.slice(0, PREVIEW_LIMIT)
  const showingMore = items.length > PREVIEW_LIMIT || (query.data?.hasMore ?? false)

  return (
    <SectionCard
      id="today-weak-spots"
      kanji="弱"
      label="Practice signals"
      count={items.length + (query.data?.hasMore ? 1 : 0)}
      description="Cards your last sessions kept catching."
      chrome="list"
      variant="default"
    >
      <ul role="list" className="flex flex-col divide-y divide-soft-hairline">
        {preview.map((spot) => (
          <PreviewRow key={spot.id} spot={spot} />
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <QuietLink href="/insights/weak-spots/drill/setup" tone="brand" trailingArrow>
          Drill these weak spots
        </QuietLink>
        {showingMore && (
          <QuietLink href="/insights/weak-spots" tone="sumi" trailingArrow>
            See all
          </QuietLink>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Preview row ─────────────────────────────────────────────────────────────

function PreviewRow({ spot }: { spot: ApiWeakSpotListItem }): React.JSX.Element {
  const isOrphan   = spot.cardId === null
  const lapseCount = spot.lapses ?? 0

  const content = (
    <div className="flex flex-col gap-y-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[1rem] leading-tight text-sumi-ink sm:text-[1.0625rem]">
          {spot.word !== null && spot.reading !== null ? (
            <FuriganaText text={spot.word} reading={spot.reading} />
          ) : (
            <span className={isOrphan ? 'italic text-faded-sumi' : ''}>
              {spot.word ?? 'Card no longer exists'}
            </span>
          )}
        </span>
        {spot.meaning !== null && (
          <span className="text-sm text-faded-sumi">{spot.meaning}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span>
          <span className="tabular-nums text-sumi-ink/85">{lapseCount}</span>{' '}
          {lapseCount === 1 ? 'lapse' : 'lapses'}
        </span>
        {spot.deckName !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate normal-case tracking-normal">{spot.deckName}</span>
          </>
        )}
        {spot.jlptLevel !== null && (
          <>
            <span aria-hidden="true">·</span>
            <Pill
              variant="level"
              tone={jlptPillTone(spot.jlptLevel)}
              size="sm"
            >
              {spot.jlptLevel === 'beyond_jlpt' ? 'Beyond' : spot.jlptLevel}
            </Pill>
          </>
        )}
      </div>
    </div>
  )

  // Orphan rows (the card was deleted) keep the row inert — no link
  // target makes sense. Non-orphan rows wrap the row content in a Link
  // to the card detail page so a keyboard user can land directly on the
  // card from one tab stop.
  if (isOrphan || spot.cardId === null) {
    return <li>{content}</li>
  }

  return (
    <li>
      <Link
        href={`/cards/${spot.cardId}?from=today`}
        className="block rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 hover:bg-cream-inset/40"
      >
        {content}
      </Link>
    </li>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Tiny local copy of the same helper used by
 * `apps/web/app/(app)/insights/weak-spots/_components/weak-spot-list-item.tsx`.
 * Inlined to avoid a cross-feature import; the function is six cases of
 * pure-function mapping with no real coupling to the insights surface.
 */
function jlptPillTone(level: string): JlptPillLevel {
  if (level === 'N1' || level === 'N2' || level === 'N3' || level === 'N4' || level === 'N5') {
    return level
  }
  return 'beyond_jlpt'
}
