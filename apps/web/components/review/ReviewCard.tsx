'use client'

import { useEffect, useState } from 'react'
import { useQuery }            from '@tanstack/react-query'

import { IconMore }            from '@/components/icons/chrome-marks'

import { SectionCard } from '@/components/ui/SectionCard'
import { CardBack }   from './session/CardBack'
import { CardFront }  from './session/CardFront'
import { FrequencyBadge } from './session/FrequencyBadge'
import { resolveCardFields } from './session/card-fields'
import { RatingBar } from './RatingBar'
import { OverflowMenu }     from '@/app/(app)/review/session/_components/overflow-menu'
import { SessionTopBar }    from '@/app/(app)/review/session/_components/session-top-bar'
import { SessionTeachSheet } from '@/app/(app)/review/session/_components/session-teach-sheet'
import {
  useCurrentCard,
  useCurrentIndex,
  useReviewQueue,
  useShowAnswer,
  useSessionActions,
} from '@/stores/useReviewSessionStore'
import { useSessionDevOverrides } from '@/stores/useSessionDevOverridesStore'
import {
  useSessionPreferences,
  useSessionPreferencesActions,
} from '@/stores/useSessionPreferencesStore'
import { queryKeys }     from '@/lib/api/queryKeys'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { cn }            from '@/lib/utils'
import type { UserRating } from '@fsrs-japanese/shared-types'
import type { FuriganaMode } from '@/stores/useSessionPreferencesStore'

// Review Session v4 orchestrator.
//
// Three persistent surfaces compose the page:
//   1. SessionTopBar (fixed top, page-scope chrome, learner prefs + session controls)
//   2. Centered SectionCard (the card itself, omitTitle: only stripe + body + in-card ⋯)
//   3. RatingBar (fixed bottom, page-scope decision bar)
//
// The card scrolls internally if its content exceeds the available height
// between top bar and rating bar; top bar and rating bar always stay put.

interface ReviewCardProps {
  /** Live submission failure from the page-level review mutation. Combined
   *  with `overrides.forceSyncError` so designers can preview the pill in
   *  the dev dock without masking a real sync error. */
  liveSyncError?: boolean
  /** Whether the most recent rating can still be undone (lives behind the
   *  page-level 3s deferred-submit timer). When true, `U` triggers `onUndo`. */
  canUndo?: boolean
  onUndo?: () => void
  /** Lifted to the page so end-session can flush any pending review before
   *  navigating away. */
  onEndSession: () => void
}

const TEACH_FLAG_KEY = 'tomo.session.hasSeenTeach'

export function ReviewCard({ liveSyncError = false, canUndo = false, onUndo, onEndSession }: ReviewCardProps): React.JSX.Element | null {
  const card              = useCurrentCard()
  const queue             = useReviewQueue()
  const currentIndex      = useCurrentIndex()
  const storeShowAnswer   = useShowAnswer()
  const overrides         = useSessionDevOverrides()
  const prefs             = useSessionPreferences()
  const prefsActions      = useSessionPreferencesActions()
  const { flipCard, submitRating } = useSessionActions()

  const showAnswer = storeShowAnswer || overrides.forceShowAnswer

  // Teach sheet: auto-show on the first session a learner ever sees, and
  // available on demand via the `?` button in the top bar. The persisted
  // flag is set once the auto-show is dismissed; manual opens don't touch it.
  const [teachOpen, setTeachOpen] = useState(false)
  const [teachMode, setTeachMode] = useState<'auto' | 'manual'>('auto')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(TEACH_FLAG_KEY) === 'true'
    if (!seen) {
      setTeachMode('auto')
      setTeachOpen(true)
    }
  }, [])

  function handleTeachClose(): void {
    setTeachOpen(false)
    if (teachMode === 'auto' && typeof window !== 'undefined') {
      try { window.localStorage.setItem(TEACH_FLAG_KEY, 'true') } catch { /* private mode etc. */ }
    }
  }

  function handleOpenTeach(): void {
    setTeachMode('manual')
    setTeachOpen(true)
  }

  const deckId = card?.deckId ?? ''
  const { data: deck } = useQuery({
    queryKey:  queryKeys.decks.detail(deckId),
    queryFn:   () => getDeckAction(deckId),
    enabled:   deckId !== '' && deckId !== 'fixture-deck',
    staleTime: 1000 * 60 * 30,
  })

  useEffect(() => {
    prefsActions.setActiveDefTab('nuance')
  }, [card?.id, prefsActions])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      // While the teach sheet is open, the sheet's own listener handles
      // dismissal; suppress the rating shortcuts to avoid double-firing.
      if (teachOpen) return

      if ((e.key === 'u' || e.key === 'U') && canUndo && onUndo !== undefined) {
        e.preventDefault()
        onUndo()
        return
      }

      if (!showAnswer) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          flipCard()
        }
        return
      }

      const ratingMap: Record<string, UserRating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }
      const rating = ratingMap[e.key]
      if (rating !== undefined) {
        e.preventDefault()
        submitRating(rating)
        return
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        prefsActions.setActiveDefTab(prefs.activeDefTab === 'mnemonic' ? 'nuance' : 'mnemonic')
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        prefsActions.setActiveDefTab(prefs.activeDefTab === 'kanji' ? 'nuance' : 'kanji')
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showAnswer, flipCard, submitRating, prefsActions, prefs.activeDefTab, teachOpen, canUndo, onUndo])

  if (card === undefined) return null

  function cycleFurigana(): void {
    const order: FuriganaMode[] = ['hover', 'always', 'off']
    const next = order[(order.indexOf(prefs.furiganaMode) + 1) % order.length] ?? 'hover'
    prefsActions.setFuriganaMode(next)
  }

  const total      = queue.length
  const completed  = Math.min(currentIndex, total)
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  const liveOrForcedSyncError = (liveSyncError || overrides.forceSyncError) && !overrides.forceOffline

  // The card is a constant. One width for every card so a learner sees the
  // same object 50 times in a session — peripheral vision doesn't have to
  // refocus as the deck cycles. The picture+WordStack composition sets the
  // natural ceiling at 960px; bare cards take the same room and let the
  // headword sit in generous paper.
  const fields    = resolveCardFields(card)
  const cardMaxW  = 'max-w-[960px]'

  return (
    <>
      <SessionTopBar
        percentage={percentage}
        offline={overrides.forceOffline}
        syncError={liveOrForcedSyncError}
        onEndSession={onEndSession}
        onOpenTeach={handleOpenTeach}
      />

      <div
        className={cn(
          // Centered horizontally; vertically centered between top bar and
          // rating bar via the layout's flex container.
          'mx-auto flex w-full flex-col px-4 md:px-6',
          cardMaxW,
          // Reserve room below for the fixed rating bar (so the card never
          // hides behind it). The pb here pairs with the layout's overflow-y
          // so the inner card scroll behaves predictably.
          'pb-[6rem] md:pb-[7rem]',
        )}
      >
        <SectionCard kanji="" label="" stripeTone="brand" omitTitle>
          {/* Bonded top row: Frequency badge on the left, ⋯ on the right,
              directly under the vermillion stripe. Replaces the previous
              absolute-positioned ⋯ float so the card has a real chrome
              row anchoring the top edge. FrequencyBadge returns null when
              no rank is present; the ⋯ keeps the row's right anchor in
              either case. */}
          <div className="flex items-center justify-between gap-3 px-1 pt-3 pb-2 md:px-2 md:pt-4 md:pb-2 border-b border-soft-hairline/40">
            <FrequencyBadge rank={fields.frequencyRank} />
            <OverflowMenu
              deckName={deck?.name ?? null}
              audioMuted={prefs.audioMuted}
              onToggleAudio={() => prefsActions.setAudioMuted(!prefs.audioMuted)}
              furiganaMode={prefs.furiganaMode}
              onCycleFurigana={cycleFurigana}
              trigger={
                <span
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-md text-faded-sumi',
                    'hover:bg-cream-inset/60 hover:text-sumi-ink transition-colors duration-150',
                    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                  )}
                >
                  <IconMore aria-hidden="true" className="w-[17px] h-[17px]" />
                </span>
              }
            />
          </div>
          <div className="px-1 pt-5 pb-2 md:px-2 md:pt-7 md:pb-3">
            {showAnswer ? <CardBack card={card} /> : <CardFront card={card} />}
          </div>
        </SectionCard>
      </div>

      {showAnswer && <RatingBar onRate={submitRating} />}

      <SessionTeachSheet open={teachOpen} mode={teachMode} onClose={handleTeachClose} />
    </>
  )
}
