'use client'

import { useEffect, useState } from 'react'
import type { ApiTomoNote } from '@fsrs-japanese/shared-types'

import { useWeakSpotsQuery } from '@/lib/api/weak-spots'
import { useTomoNoteQuery } from '@/lib/api/tomo'

import { TodayWeakSpotsCard } from './today-weak-spots-card'

const WEAK_SPOT_PREVIEW_LIMIT = 2

interface TodayPreSessionNoteProps {
  /**
   * Calendar date key in the learner's timezone (YYYY-MM-DD). Used as the
   * cache scope for the Tomo note so it rotates at local midnight rather
   * than UTC midnight.
   */
  dateKey: string
}

/**
 * Owner of the IA's "concise pre-session note" slot
 * (`docs/information_architecture/01_today.md:27`). Picks one of two
 * contents based on the learner's current state, never both:
 *
 * 1. Unresolved weak spots exist: hand off to `TodayWeakSpotsCard`. The
 *    operational signal (cards your last sessions kept catching) wins
 *    because it is actionable and the slot was originally designed for it.
 * 2. No unresolved weak spots: render today's Tomo note as ambient
 *    teacher-text, gated so the AI daily quota isn't spent on busy days
 *    when the note would be suppressed anyway.
 * 3. Neither available: render nothing, the page's grid gap absorbs the
 *    absence so Today stays calm.
 *
 * Both branches feed the same surface so the slot's vertical rhythm reads
 * the same across days. The weak-spots branch reuses the existing card
 * unchanged; only the calm-day branch is new chrome.
 */
export function TodayPreSessionNote({ dateKey }: TodayPreSessionNoteProps): React.JSX.Element | null {
  // Same params as TodayWeakSpotsCard so the two consumers share one
  // TanStack Query cache entry. The child still self-queries; the parent
  // here only reads to decide the slot.
  const weakSpotsQuery = useWeakSpotsQuery({
    status: 'unresolved',
    limit:  WEAK_SPOT_PREVIEW_LIMIT + 1,
    sort:   'mostRecent',
  })

  const weakSpotsSettled = !weakSpotsQuery.isLoading && !weakSpotsQuery.isError
  const hasWeakSpots     = (weakSpotsQuery.data?.items.length ?? 0) > 0

  // Gate the network call on the weak-spots branch having resolved to zero
  // items. The Tomo note endpoint is rate-limited by AI minute quota AND
  // AI daily quota; firing it on busy days would burn the daily budget
  // on a note that never gets rendered.
  const tomoNoteEnabled = weakSpotsSettled && !hasWeakSpots
  const tomoNoteQuery   = useTomoNoteQuery({ dateKey, enabled: tomoNoteEnabled })

  if (!weakSpotsSettled) return null

  if (hasWeakSpots) return <TodayWeakSpotsCard />

  if (tomoNoteQuery.isLoading || tomoNoteQuery.isError) return null
  const note = tomoNoteQuery.data
  if (note === null || note === undefined) return null

  return <TomoNoteBody note={note} />
}

// ─── Tomo note body ──────────────────────────────────────────────────────────

function TomoNoteBody({ note }: { note: ApiTomoNote }): React.JSX.Element {
  // Match the hydration-fade pattern used by the greeting eyebrow at
  // today-client.tsx so the note slides in on the same cadence rather
  // than popping. Reduced-motion users get the final state immediately
  // via the `motion-reduce:transition-none` modifier.
  const [shown, setShown] = useState(false)
  useEffect(() => { setShown(true) }, [])

  return (
    <aside
      aria-label="A note for today"
      className={[
        'max-w-[48rem]',
        'transition-opacity duration-500 ease-out motion-reduce:transition-none',
        shown ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <p className="flex items-start gap-x-2.5 text-[1.0625rem] leading-relaxed text-faded-sumi">
        <FoxGlyph />
        <span className="font-display">{note.body}</span>
      </p>
    </aside>
  )
}

// ─── Inline fox glyph ────────────────────────────────────────────────────────

/**
 * Inlined to (a) avoid an extra request for a 24×24 vector and (b) inherit
 * `text-inari-vermillion` from the consumer through `currentColor`. The
 * standalone asset at `apps/web/public/brand/fox-glyph.svg` mirrors the
 * same path for non-React surfaces.
 *
 * `flex h-[1.6em] items-center` parks the glyph at the optical center of
 * the first line of body text without needing a magic translate-y value.
 * The `1.6em` matches the body's `leading-relaxed`.
 */
function FoxGlyph(): React.JSX.Element {
  return (
    <span className="flex h-[1.6em] shrink-0 items-center text-inari-vermillion" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="size-[1.05em]"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 3.4 9.2 6.6c-1.7-.2-3.2.2-4.5 1-.7.4-.6 1 .2 1.1l1.8.3c-.8.9-1.2 2-1.2 3.3 0 2.1 1 4 2.7 5.2.5.3.5.7 0 1l-1.3.8c-.6.4-.4 1.2.3 1.3 2.1.3 4-.4 5.4-1.7 1.4 1.3 3.3 2 5.4 1.7.7-.1.9-.9.3-1.3l-1.3-.8c-.5-.3-.5-.7 0-1 1.7-1.2 2.7-3.1 2.7-5.2 0-1.3-.4-2.4-1.2-3.3l1.8-.3c.8-.1.9-.7.2-1.1-1.3-.8-2.8-1.2-4.5-1L12 3.4Zm-2.8 8.3c.5 0 .9.4.9 1s-.4 1-.9 1-.9-.4-.9-1 .4-1 .9-1Zm5.6 0c.5 0 .9.4.9 1s-.4 1-.9 1-.9-.4-.9-1 .4-1 .9-1ZM12 14.9c.6 0 1.1.2 1.5.6.3.3 0 .8-.4.7l-1.1-.2-1.1.2c-.4.1-.7-.4-.4-.7.4-.4.9-.6 1.5-.6Z"
        />
      </svg>
    </span>
  )
}
