'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { TopBarBackLink } from '@/app/(app)/_components/top-bar-back-link'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/TomoLoader'
import { Dialog } from '@/components/ui/Dialog'
import { SectionCard } from '@/components/ui/SectionCard'
import { Toast, useToast } from '@/components/ui/Toast'
import { CardBack } from '@/components/review/session/CardBack'
import { FrequencyBadge } from '@/components/review/session/FrequencyBadge'
import {
  getCardByIdAction,
  deleteCardAction,
} from '@/lib/actions/cards.actions'
import {
  useForgetCardMutation,
  useMoveCardMutation,
  useRescheduleCardMutation,
  useSuspendCardMutation,
  useUnsuspendCardMutation,
} from '@/lib/api/cards'
import { queryKeys } from '@/lib/api/queryKeys'
import { DecksMenu, MenuItem, MenuSeparator } from '@/app/(app)/decks/_components/decks-menu'
import {
  IconCalendar,
  IconDecks,
  IconDelete,
  IconEdit,
  IconHide,
  IconMore,
  IconPause,
  IconPlay,
  IconReveal,
  IconUndo,
} from '@/components/icons/chrome-marks'
import { MoveCardDialog } from '@/app/(app)/decks/[id]/_components/move-card-dialog'
import {
  getSentenceFrontBack,
  getVocabularyFields,
  getWordFields,
  type ApiCard,
  type ApiCardListItem,
  type ApiDueCard,
} from '@fsrs-japanese/shared-types'
import { cn } from '@/lib/utils'

import { CardHistoryPanel } from './card-history-panel'
import { useCardDevState } from '@/dev/panels/card-detail'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  cardId:   string
  deckId:   string
  deckName: string
}

type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'move' }
  | { kind: 'suspend' }
  | { kind: 'forget' }
  | { kind: 'reschedule' }

// ─── Component ────────────────────────────────────────────────────────────────

export function CardDetailView({ cardId, deckId, deckName }: Props): React.JSX.Element {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const [activeDialog,  setActiveDialog]  = useState<ActiveDialog>({ kind: 'none' })
  const [showHistory,   setShowHistory]   = useState(false)
  const [resetCount,    setResetCount]    = useState(false)
  // Which example sentence the card back shows. Mirrors the /add/review and
  // edit preview pagers: pinning makes this view deterministic (the review
  // back rotates per-review) and the pager below steps through the others.
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const { toast, showToast, dismissToast } = useToast()

  const { data: liveCard, isLoading: liveLoading } = useQuery({
    queryKey: queryKeys.cards.detail(cardId),
    queryFn:  () => getCardByIdAction(cardId),
  })

  // Dev-only fixture override. In production, devState is always
  // `{ fixture: 'off', card: null, loading: false }` and `panel` is null;
  // the card / isLoading bindings then fall through to the live query.
  const devState = useCardDevState(deckId)
  const card      = devState.fixture === 'off' ? liveCard       : devState.card
  const isLoading = devState.fixture === 'off' ? liveLoading    : devState.loading

  // ── Content extraction ────────────────────────────────────────────────
  // The CardBack component (rendered below) does its own field resolution
  // via `resolveCardFields`, so the orchestrator only extracts what the
  // page chrome needs: the headword + reading/meaning for the identity
  // header and the frequency rank for the bonded badge on the card.
  // (Scheduling/FSRS fields are read directly by CardHistoryPanel.)
  const wordFields  = card != null ? getWordFields(card)       : null
  const sentence    = card != null ? getSentenceFrontBack(card) : null

  const word            = wordFields?.word ?? sentence?.front ?? '—'
  // Identity subline: reading sits under the headword for word cards; for
  // sentence cards there's no reading, so the English translation (back)
  // carries the meaning slot instead.
  const reading         = wordFields?.reading ?? null
  const meaning         = wordFields?.meaning ?? sentence?.back ?? null
  const frequencyRank   = wordFields?.frequencyRank ?? undefined

  // Example-sentence pager. Only vocabulary cards carry an `exampleSentences`
  // array; sentence-layout cards have one sentence (no pager). Clamp so the
  // index survives a card swap (e.g. after a move) without going stale.
  const sentenceCount   = card != null ? (getVocabularyFields(card)?.exampleSentences?.length ?? 0) : 0
  const clampedSentence = sentenceCount > 0 ? Math.min(sentenceIndex, sentenceCount - 1) : 0
  const showPager       = sentenceCount > 1

  const isPremadeSource = card !== null && card !== undefined && (card as { userId?: string | null }).userId === null
  const isSuspended     = card?.isSuspended === true

  // ── Card-delete mutation ──────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deleteCardAction(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      router.push(`/decks/${deckId}`)
    },
  })

  // ── Suspend / unsuspend / move mutations ──────────────────────────────
  // The hooks invalidate cards.all() + decks.all() so the liveCard query
  // re-reads after suspend/unsuspend (driving the `isSuspended` chrome) and
  // every list view that includes this card refreshes after a move.
  const suspendMutation   = useSuspendCardMutation()
  const unsuspendMutation = useUnsuspendCardMutation()
  const moveMutation      = useMoveCardMutation()
  const suspendPending    = isSuspended ? unsuspendMutation.isPending : suspendMutation.isPending
  const suspendError      = isSuspended
    ? (unsuspendMutation.isError ? (unsuspendMutation.error?.message ?? 'Unknown error') : null)
    : (suspendMutation.isError   ? (suspendMutation.error?.message   ?? 'Unknown error') : null)

  // ── Repair mutations (folded in from the retired /repair route) ───────
  // Both already invalidate the card caches, so the live `liveCard` query
  // refetches and the card preview + memory popup update in place. No navigation.
  const forgetMutation     = useForgetCardMutation()
  const rescheduleMutation = useRescheduleCardMutation()

  function closeRepairDialog(): void {
    if (forgetMutation.isPending || rescheduleMutation.isPending) return
    setActiveDialog({ kind: 'none' })
    forgetMutation.reset()
    rescheduleMutation.reset()
  }

  const editHref = `/cards/${cardId}/edit`

  // ── Page-level keyboard shortcuts: E edits, Shift+M opens the memory
  // popup. Bare M is the in-card mnemonic tab, so memory takes Shift+M.
  // Suppressed while typing or while any dialog is open (the memory popup
  // and the others all close via Esc); E is a no-op on premade cards.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null) return

      const key = e.key.toLowerCase()
      if (e.shiftKey && key === 'm') {
        e.preventDefault()
        setShowHistory((v) => !v)
        return
      }
      if (!e.shiftKey && key === 'e' && !isPremadeSource) {
        e.preventDefault()
        router.push(editHref)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [router, editHref, isPremadeSource])

  if (isLoading) {
    return (
      <>
        <TopBar>
          <TopBarBackLink href={`/decks/${deckId}`} ariaLabel={`Back to ${deckName}`} />
        </TopBar>
        <PageLoader />
      </>
    )
  }

  return (
    <>
      {/* Minimal TopBar — deck-back + word only. No actions. */}
      <TopBar>
        <TopBarBackLink href={`/decks/${deckId}`} ariaLabel={`Back to ${deckName}`} />
        <TopBarTitle kanji="札" label={word} labelLang="ja" />
      </TopBar>

      {/* Vertical centering: this wrapper fills the viewport minus the
          sticky TopBar (h-16 = 4rem) and uses flex to center its child on
          the remaining axis. Falls back to natural scroll when the content
          is taller than the viewport. */}
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center bg-cool-paper-base py-10 lg:py-16">
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
          {/* Content spans the full 1440px container. */}
          <div className="w-full">

            {/* ── Page header — dictionary-style identity for this card.
                The headword is the hero (Japanese is the most beautiful
                thing on the page); deck + JLPT ride the eyebrow as context
                (and are therefore dropped from the meta strip below to keep
                the page from repeating itself). */}
            <div className="pb-3 sm:pb-4 lg:pb-5">
              <CardIdentityHeader
                word={word}
                reading={reading}
                meaning={meaning}
                deckName={deckName}
                jlptLevel={card?.jlptLevel ?? null}
                isSuspended={isSuspended}
              />
            </div>

            {/* ── Actions strip right under the header. Ordered by intent:
                modify → inspect → fix → pause → destroy. */}
            {card !== null && card !== undefined && (
              <div className="mb-6 lg:mb-7">
                <CardActionsStrip
                  editHref={editHref}
                  isPremade={isPremadeSource}
                  isSuspended={isSuspended}
                  historyOpen={showHistory}
                  onMove={() => setActiveDialog({ kind: 'move' })}
                  onToggleHistory={() => setShowHistory((v) => !v)}
                  onForget={() => { setResetCount(false); setActiveDialog({ kind: 'forget' }) }}
                  onReschedule={() => setActiveDialog({ kind: 'reschedule' })}
                  onSuspend={() => setActiveDialog({ kind: 'suspend' })}
                  onDelete={() => setActiveDialog({ kind: 'delete' })}
                />
              </div>
            )}

            {/* ── Body: the card itself. The memory / scheduling history
                opens in a popup (see the Dialog below) so the curve can use
                the full content width instead of a cramped side rail. */}
            <div className="flex flex-col gap-y-6 lg:gap-y-8">
              {isLoading && <LoadingBody />}

              {card !== null && card !== undefined && (
                <SectionCard kanji="札" label="Card back" omitTitle>
                  {/* Bonded top row mirrors the review card: the frequency
                      badge sits under the vermillion stripe. Renders only
                      when the card has a rank, so there's no empty row. */}
                  {frequencyRank != null && (
                    <div className="flex items-center gap-2 px-1 pt-3 pb-2 md:px-2 md:pt-4 md:pb-2">
                      <FrequencyBadge rank={frequencyRank} />
                    </div>
                  )}
                  <div className="px-1 pt-5 pb-2 md:px-2 md:pt-7 md:pb-3">
                    <CardBack
                      card={card as unknown as ApiDueCard}
                      exampleSentenceIndex={clampedSentence}
                      manageTabShortcuts
                      revealTranslation
                    />
                  </div>
                </SectionCard>
              )}

              {/* Example-sentence pager — same control as the /add/review and
                  edit previews: sits under the card, right-aligned. */}
              {card !== null && card !== undefined && showPager && (
                <div className="flex items-center justify-end gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <PagerButton
                      onClick={() => setSentenceIndex((i) => Math.max(0, i - 1))}
                      disabled={clampedSentence <= 0}
                      ariaLabel="Previous example sentence"
                    >‹</PagerButton>
                    <span className="text-sm text-faded-sumi tabular-nums" aria-live="polite">
                      Sentence {clampedSentence + 1} of {sentenceCount}
                    </span>
                    <PagerButton
                      onClick={() => setSentenceIndex((i) => Math.min(sentenceCount - 1, i + 1))}
                      disabled={clampedSentence >= sentenceCount - 1}
                      ariaLabel="Next example sentence"
                    >›</PagerButton>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <Dialog
        open={activeDialog.kind === 'delete'}
        onClose={() => setActiveDialog({ kind: 'none' })}
        title="Delete card"
      >
        <p className="mb-5 text-sm text-faded-sumi">
          Permanently delete{' '}
          <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
          {' '}from {deckName}? This cannot be undone.
        </p>
        {deleteMutation.isError && (
          <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
            {deleteMutation.error?.message ?? 'Unknown error'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveDialog({ kind: 'none' })}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete card
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={activeDialog.kind === 'suspend'}
        onClose={() => {
          if (suspendPending) return
          setActiveDialog({ kind: 'none' })
          suspendMutation.reset()
          unsuspendMutation.reset()
        }}
        title={isSuspended ? 'Unsuspend card' : 'Suspend card'}
      >
        <p className="mb-5 text-sm text-faded-sumi">
          {isSuspended
            ? <>Return <span lang="ja" className="font-semibold text-sumi-ink">{word}</span> to the active review queue?</>
            : <>Pause <span lang="ja" className="font-semibold text-sumi-ink">{word}</span> from appearing in reviews until you unsuspend it?</>
          }
        </p>
        {suspendError !== null && (
          <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
            {suspendError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveDialog({ kind: 'none' })
              suspendMutation.reset()
              unsuspendMutation.reset()
            }}
            disabled={suspendPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={suspendPending}
            onClick={() => {
              const mutation = isSuspended ? unsuspendMutation : suspendMutation
              mutation.mutate(cardId, {
                onSuccess: () => {
                  setActiveDialog({ kind: 'none' })
                  showToast(isSuspended ? 'Card unsuspended.' : 'Card suspended.')
                },
              })
            }}
          >
            {isSuspended ? 'Unsuspend' : 'Suspend'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={activeDialog.kind === 'forget'}
        onClose={closeRepairDialog}
        title="Forget card"
      >
        <p className="mb-4 text-sm text-faded-sumi">
          Reset scheduling on{' '}
          <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>{' '}
          and queue it as new again. Your review log stays intact.
        </p>
        <label className="mb-5 flex items-start gap-3 text-sm text-sumi-ink">
          <input
            type="checkbox"
            checked={resetCount}
            onChange={(e) => setResetCount(e.target.checked)}
            disabled={forgetMutation.isPending}
            className="mt-0.5 h-4 w-4 accent-inari-vermillion-deep"
          />
          <span>
            <span className="block font-medium">Also reset lifetime counters</span>
            <span className="block text-xs text-faded-sumi">Zeroes reps + lapses. Off by default so the card&rsquo;s history stays in your analytics.</span>
          </span>
        </label>
        {forgetMutation.isError && (
          <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
            {forgetMutation.error?.message ?? 'Unknown error'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeRepairDialog} disabled={forgetMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={forgetMutation.isPending}
            onClick={() => {
              const variables = resetCount ? { cardId, resetCount: true } : { cardId }
              forgetMutation.mutate(variables, {
                onSuccess: () => {
                  setActiveDialog({ kind: 'none' })
                  showToast('Card forgotten.')
                },
              })
            }}
          >
            Forget card
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={activeDialog.kind === 'reschedule'}
        onClose={closeRepairDialog}
        title="Reschedule card"
      >
        <p className="mb-5 text-sm text-faded-sumi">
          Replay{' '}
          <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>&rsquo;s
          review history and recompute its schedule from scratch. This won&rsquo;t
          change your review log.
        </p>
        {rescheduleMutation.isError && (
          <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
            {rescheduleMutation.error?.message ?? 'Unknown error'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeRepairDialog} disabled={rescheduleMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={rescheduleMutation.isPending}
            onClick={() => {
              rescheduleMutation.mutate(cardId, {
                onSuccess: () => {
                  setActiveDialog({ kind: 'none' })
                  showToast('Schedule recomputed.')
                },
              })
            }}
          >
            Reschedule card
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={showHistory && card !== null && card !== undefined}
        onClose={() => setShowHistory(false)}
        eyebrow={{ kanji: '記', label: 'MEMORY' }}
        size="5xl"
      >
        {card !== null && card !== undefined && (
          <div id="card-history-panel">
            <CardHistoryPanel card={card} />
          </div>
        )}
      </Dialog>

      <MoveCardDialog
        card={activeDialog.kind === 'move' && card !== null && card !== undefined ? (card as unknown as ApiCardListItem) : null}
        currentDeckId={deckId}
        variant="move"
        isSubmitting={moveMutation.isPending}
        errorMessage={moveMutation.isError ? (moveMutation.error?.message ?? 'Unknown error') : null}
        onCancel={() => {
          setActiveDialog({ kind: 'none' })
          moveMutation.reset()
        }}
        onConfirm={(target, targetDeckId) => {
          moveMutation.mutate(
            { cardId: target.id, targetDeckId },
            {
              onSuccess: () => {
                setActiveDialog({ kind: 'none' })
                showToast('Card moved.')
                // The breadcrumb (`deckId`, `deckName`) is sourced from this
                // route's server component; refresh re-runs that fetch so the
                // top-bar updates to the new deck without a full reload.
                router.refresh()
              },
            },
          )
        }}
      />

      {toast !== null && (
        <Toast
          key={toast.key}
          message={toast.message}
          kind={toast.kind}
          onDismiss={dismissToast}
        />
      )}

    </>
  )
}

// ─── Sub-views ───────────────────────────────────────────────────────────

function CardIdentityHeader({
  word,
  reading,
  meaning,
  deckName,
  jlptLevel,
  isSuspended,
}: {
  word:        string
  reading:     string | null
  meaning:     string | null
  deckName:    string
  jlptLevel:   ApiCard['jlptLevel']
  isSuspended: boolean
}): React.JSX.Element {
  // Eyebrow context: where the card lives and its level. ("Card" is dropped —
  // the TopBar already establishes this is a card, so the eyebrow leads with
  // the real context.)
  const jlptLabel = jlptLevel === null
    ? null
    : jlptLevel === 'beyond_jlpt' ? 'Beyond JLPT' : jlptLevel
  const eyebrow = [deckName, jlptLabel].filter(
    (s): s is string => s !== null && s !== '',
  )

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm text-faded-sumi">
          <span
            lang="ja"
            aria-hidden="true"
            className="font-display text-lg leading-none translate-y-[0.05em] text-inari-vermillion"
          >
            札
          </span>
          {eyebrow.map((seg, i) => (
            <span key={seg} className="inline-flex items-baseline gap-3">
              {i > 0 && <span aria-hidden="true" className="text-faded-sumi/55">·</span>}
              <span>{seg}</span>
            </span>
          ))}
        </p>

        {/* Headword is the hero. CJK stack + lang="ja" so screen readers
            pronounce it and the type renders in the Japanese face. */}
        <h1
          lang="ja"
          className="mt-3 break-words font-japanese font-medium leading-tight text-sumi-ink text-title"
        >
          {word}
        </h1>

        {(reading !== null || meaning !== null) && (
          <p className="mt-1.5 flex max-w-measure flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-relaxed text-faded-sumi lg:text-base">
            {reading !== null && (
              <span lang="ja" className="font-japanese text-sumi-ink/80">{reading}</span>
            )}
            {reading !== null && meaning !== null && (
              <span aria-hidden="true" className="text-faded-sumi/55">·</span>
            )}
            {meaning !== null && <span>{meaning}</span>}
          </p>
        )}
      </div>

      {isSuspended && (
        <div className="hidden shrink-0 items-center sm:flex">
          <span className="rounded-xs border border-soft-hairline bg-cream-inset px-2.5 py-1 font-mono text-xs text-faded-sumi">
            Suspended
          </span>
        </div>
      )}
    </header>
  )
}

function CardActionsStrip({
  editHref,
  isPremade,
  isSuspended,
  historyOpen,
  onMove,
  onToggleHistory,
  onForget,
  onReschedule,
  onSuspend,
  onDelete,
}: {
  editHref:        string
  isPremade:       boolean
  isSuspended:     boolean
  historyOpen:     boolean
  onMove:          () => void
  onToggleHistory: () => void
  onForget:        () => void
  onReschedule:    () => void
  onSuspend:       () => void
  onDelete:        () => void
}): React.JSX.Element {
  const dot = <span aria-hidden="true" className="text-faded-sumi/55">·</span>
  const suspendIcon = isSuspended
    ? <IconPlay className="h-4 w-4" />
    : <IconPause className="h-4 w-4" />
  const suspendLabel = isSuspended ? 'Unsuspend' : 'Suspend'

  return (
    <>
      {/* ── Touch context (< lg): the calm progressive-disclosure layout.
          This is the same line the app draws everywhere else — below lg there's
          no sidebar (the mobile drawer takes over), the surface is touch-first,
          and the "More" (⋯) menu gives every action a comfortable target
          instead of a row of 36px chips under a thumb. Two everyday actions stay
          inline; the rest live in the menu in intent order: placement → repair
          → pause → destroy. */}
      <nav
        aria-label="Card actions"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm lg:hidden"
      >
        <ActionLink
          href={editHref}
          icon={<IconEdit className="h-4 w-4 shrink-0" />}
          disabled={isPremade}
          {...(isPremade ? { title: 'Premade cards can’t be edited directly' } : {})}
        >
          Edit
        </ActionLink>
        {dot}
        <ActionButton
          onClick={onToggleHistory}
          icon={historyOpen
            ? <IconHide className="h-4 w-4 shrink-0" />
            : <IconReveal className="h-4 w-4 shrink-0" />}
          ariaExpanded={historyOpen}
          ariaControls="card-history-panel"
          ariaHasPopup="dialog"
        >
          {historyOpen ? 'Hide memory' : 'Show memory'}
        </ActionButton>
        <DecksMenu
          align="end"
          menuClassName="min-w-[13rem]"
          renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef, menuId }) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={onClick}
              onKeyDown={onKeyDown}
              aria-haspopup="menu"
              aria-expanded={ariaExpanded}
              aria-controls={menuId}
              aria-label="More actions"
              className={[
                'ui-motion-colors -my-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xs',
                'text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink active:bg-cream-inset',
                'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              ].join(' ')}
            >
              <IconMore className="h-4 w-4" />
            </button>
          )}
          renderItems={({ close }) => (
            <>
              <MenuItem
                leading={<IconDecks className="h-3.5 w-3.5" />}
                onClick={() => { onMove(); close() }}
                disabled={isPremade}
              >
                Move to another deck
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                leading={<IconUndo className="h-3.5 w-3.5" />}
                onClick={() => { onForget(); close() }}
              >
                Forget
              </MenuItem>
              <MenuItem
                leading={<IconCalendar className="h-3.5 w-3.5" />}
                onClick={() => { onReschedule(); close() }}
              >
                Reschedule
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                leading={suspendIcon}
                onClick={() => { onSuspend(); close() }}
              >
                {suspendLabel}
              </MenuItem>
              <MenuItem
                leading={<IconDelete className="h-3.5 w-3.5" />}
                onClick={() => { onDelete(); close() }}
                disabled={isPremade}
                danger
              >
                Delete
              </MenuItem>
            </>
          )}
        />
      </nav>

      {/* ── Desktop (lg+, pointer + sidebar): no overflow menu. Every action is
          laid out in the open and clustered by utility — like a Photoshop tool
          group — in the documented intent order: modify → inspect → organize →
          schedule-repair → availability. The row wraps by cluster on narrower
          desktops (lg sits at ~608px of content once the sidebar lands), so the
          generous inter-cluster gap carries the grouping; the hairline dividers
          only appear at xl+, where the toolbar is guaranteed a single row and a
          rule can't dangle at a wrap point. */}
      <nav
        aria-label="Card actions"
        className="hidden flex-wrap items-stretch gap-x-5 gap-y-3 text-sm lg:flex"
      >
        {/* Modify + inspect — the two things you do to read/change this card. */}
        <ToolGroup>
          <ToolAction
            href={editHref}
            icon={<IconEdit className="h-4 w-4" />}
            disabled={isPremade}
            {...(isPremade ? { title: 'Premade cards can’t be edited directly' } : {})}
          >
            Edit
          </ToolAction>
          <ToolAction
            onClick={onToggleHistory}
            icon={historyOpen ? <IconHide className="h-4 w-4" /> : <IconReveal className="h-4 w-4" />}
            ariaExpanded={historyOpen}
            ariaControls="card-history-panel"
            ariaHasPopup="dialog"
          >
            {historyOpen ? 'Hide memory' : 'Show memory'}
          </ToolAction>
        </ToolGroup>

        <ToolDivider />

        {/* Organize — where the card lives. */}
        <ToolGroup>
          <ToolAction
            onClick={onMove}
            icon={<IconDecks className="h-4 w-4" />}
            disabled={isPremade}
            {...(isPremade ? { title: 'Premade cards can’t be moved' } : {})}
          >
            Move
          </ToolAction>
        </ToolGroup>

        <ToolDivider />

        {/* Scheduling repair — reset or recompute the FSRS schedule. */}
        <ToolGroup>
          <ToolAction onClick={onForget} icon={<IconUndo className="h-4 w-4" />}>
            Forget
          </ToolAction>
          <ToolAction onClick={onReschedule} icon={<IconCalendar className="h-4 w-4" />}>
            Reschedule
          </ToolAction>
        </ToolGroup>

        <ToolDivider />

        {/* Availability — pause from reviews, or destroy. Delete is danger-styled
            and sits last so the destructive action is visually distinct. */}
        <ToolGroup>
          <ToolAction onClick={onSuspend} icon={suspendIcon}>
            {suspendLabel}
          </ToolAction>
          <ToolAction
            onClick={onDelete}
            icon={<IconDelete className="h-4 w-4" />}
            disabled={isPremade}
            danger
            {...(isPremade ? { title: 'Premade cards can’t be deleted' } : {})}
          >
            Delete
          </ToolAction>
        </ToolGroup>
      </nav>
    </>
  )
}

// ─── Desktop toolbar primitives ───────────────────────────────────────────

/** A cluster of related tool actions, kept tight so the eye reads them as one
 *  unit; clusters are separated by `ToolDivider`. */
function ToolGroup({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex items-center gap-x-1.5">{children}</div>
}

/** Hairline rule between tool clusters. Mirrors the deck snapshot ribbon's
 *  divider so the chrome stays consistent across the app. Hidden below xl,
 *  where the toolbar wraps onto two rows and a rule would otherwise dangle at a
 *  wrap point; below xl the nav's inter-cluster gap carries the grouping. */
function ToolDivider(): React.JSX.Element {
  return <div aria-hidden="true" className="hidden w-px self-stretch bg-soft-hairline xl:block" />
}

/**
 * One icon + label action in the desktop toolbar. Renders a `Link` when `href`
 * is given, a `button` otherwise. Disabled links degrade to a non-interactive
 * span so the affordance still reads (e.g. premade cards can't be edited).
 */
function ToolAction({
  href,
  onClick,
  icon,
  disabled,
  danger,
  title,
  ariaExpanded,
  ariaControls,
  ariaHasPopup,
  children,
}: {
  href?:         string
  onClick?:      () => void
  icon:          React.ReactNode
  disabled?:     boolean
  danger?:       boolean
  title?:        string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaHasPopup?: 'dialog' | 'menu'
  children:      React.ReactNode
}): React.JSX.Element {
  const base =
    'ui-motion-colors inline-flex h-9 items-center gap-2 rounded-xs px-2.5 ' +
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2'
  const tone = danger === true
    ? 'text-inari-vermillion-deep hover:bg-inari-vermillion-deep/8 hover:text-inari-vermillion'
    : 'text-sumi-ink hover:bg-cream-inset hover:text-inari-vermillion-deep'

  if (disabled === true) {
    return (
      <span
        className={`${base} cursor-not-allowed text-faded-sumi/70`}
        title={title}
        aria-disabled="true"
      >
        {icon}
        {children}
      </span>
    )
  }

  if (href !== undefined) {
    return (
      <Link href={href} className={`${base} ${tone}`}>
        {icon}
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      {...(ariaExpanded !== undefined ? { 'aria-expanded': ariaExpanded } : {})}
      {...(ariaControls !== undefined ? { 'aria-controls': ariaControls } : {})}
      {...(ariaHasPopup !== undefined ? { 'aria-haspopup': ariaHasPopup } : {})}
      className={`${base} ${tone}`}
    >
      {icon}
      {children}
    </button>
  )
}

function ActionLink({
  href,
  disabled,
  title,
  icon,
  children,
}: {
  href:     string
  disabled?: boolean
  title?:   string
  icon?:    React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  // Leading icon + label. The icon aids recognition on the touch surface; the
  // underline stays on the label only (an underlined glyph reads as broken), so
  // `group-hover` drives it rather than `hover:underline` on the whole control.
  const inner = (
    <>
      {icon}
      <span className="underline-offset-2 group-hover:underline">{children}</span>
    </>
  )
  if (disabled === true) {
    return (
      <span
        className="group inline-flex items-center gap-1.5 cursor-not-allowed text-faded-sumi/70"
        title={title}
        aria-disabled="true"
      >
        {inner}
      </span>
    )
  }
  return (
    <Link
      href={href}
      // 44px-tall touch target held across the whole compact range via vertical
      // padding cancelled by negative margin. No sm reset: this control only
      // renders below lg (the desktop toolbar replaces it), so the tablet touch
      // range must keep the full target rather than collapse it.
      className="group ui-motion-colors -my-3 inline-flex items-center gap-1.5 py-3 text-sumi-ink hover:text-inari-vermillion-deep focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
    >
      {inner}
    </Link>
  )
}

function ActionButton({
  onClick,
  disabled,
  danger,
  icon,
  ariaExpanded,
  ariaControls,
  ariaHasPopup,
  children,
}: {
  onClick:       () => void
  disabled?:     boolean
  danger?:       boolean
  icon?:         React.ReactNode
  ariaExpanded?: boolean
  ariaControls?: string
  ariaHasPopup?: 'dialog' | 'menu'
  children:      React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(ariaExpanded !== undefined ? { 'aria-expanded': ariaExpanded } : {})}
      {...(ariaControls !== undefined ? { 'aria-controls': ariaControls } : {})}
      {...(ariaHasPopup !== undefined ? { 'aria-haspopup': ariaHasPopup } : {})}
      className={[
        // Icon + label control with a 44px-tall hit area held across the whole
        // compact range (no sm reset — it only renders below lg). Underline lives
        // on the label span via group-hover so the leading icon isn't underlined.
        'group ui-motion-colors -my-3 inline-flex items-center gap-1.5 py-3',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:text-faded-sumi/70',
        danger === true ? 'text-inari-vermillion-deep hover:text-inari-vermillion' : 'text-sumi-ink hover:text-inari-vermillion-deep',
      ].join(' ')}
    >
      {icon}
      <span className="underline-offset-2 group-hover:underline group-disabled:no-underline">{children}</span>
    </button>
  )
}

// Square chevron control for the example-sentence pager. Disabled at the ends
// of the list; matches the quiet font-mono register of the edit / add-review
// preview pagers so the three surfaces share one control vocabulary.
function PagerButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick:   () => void
  disabled:  boolean
  ariaLabel: string
  children:  React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-xs',
        'border border-soft-hairline font-mono text-sm leading-none',
        'transition-colors duration-150',
        disabled
          ? 'text-faded-sumi/40 cursor-not-allowed'
          : 'text-faded-sumi hover:text-sumi-ink hover:border-sumi-ink/30',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
      )}
    >
      {children}
    </button>
  )
}

function LoadingBody(): React.JSX.Element {
  return (
    <SectionCard kanji="例" label="Loading">
      <div className="flex flex-col gap-y-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="dashboard-skeleton block h-4 w-full rounded-[1px]"
          />
        ))}
      </div>
    </SectionCard>
  )
}
