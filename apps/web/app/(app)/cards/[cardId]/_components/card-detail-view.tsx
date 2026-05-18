'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Toast, useToast } from '@/components/ui/Toast'
import { CardBack } from '@/components/review/session/CardBack'
import {
  getCardByIdAction,
  deleteCardAction,
} from '@/lib/actions/cards.actions'
import {
  useMoveCardMutation,
  useSuspendCardMutation,
  useUnsuspendCardMutation,
} from '@/lib/api/cards'
import { queryKeys } from '@/lib/api/queryKeys'
import { MoveCardDialog } from '@/app/(app)/decks/[id]/_components/move-card-dialog'
import {
  State,
  getSentenceFrontBack,
  getVocabularyFields,
  getWordFields,
  type ApiCard,
  type ApiCardListItem,
  type ApiDueCard,
} from '@fsrs-japanese/shared-types'

import { FsrsStats } from './fsrs-stats'
import { useCardDevState } from './dev-state-panel'

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

// ─── Component ────────────────────────────────────────────────────────────────

export function CardDetailView({ cardId, deckId, deckName }: Props): React.JSX.Element {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: 'none' })
  const [showHistory,  setShowHistory]  = useState(false)
  const { toast, showToast, dismissToast } = useToast()

  const { data: liveCard, isLoading: liveLoading } = useQuery({
    queryKey: queryKeys.cards.detail(cardId),
    queryFn:  () => getCardByIdAction(cardId),
  })

  // Dev-only fixture override. In production, devState is always
  // `{ fixture: 'off', card: null, loading: false }` and `panel` is null;
  // the card / isLoading bindings then fall through to the live query.
  const { state: devState, panel: devPanel } = useCardDevState(deckId)
  const card      = devState.fixture === 'off' ? liveCard       : devState.card
  const isLoading = devState.fixture === 'off' ? liveLoading    : devState.loading

  // ── Content extraction ────────────────────────────────────────────────
  // The CardBack component (rendered below) does its own field resolution
  // via `resolveCardFields`, so the orchestrator only extracts what the
  // page chrome needs: the headword for dialog copy, frequency / pitch for
  // the meta strip, and the FSRS-related fields read by FsrsStats.
  const wordFields  = card != null ? getWordFields(card)       : null
  const vocabFields = card != null ? getVocabularyFields(card) : null
  const sentence    = card != null ? getSentenceFrontBack(card) : null

  const word            = wordFields?.word ?? sentence?.front ?? '—'
  const frequencyRank   = wordFields?.frequencyRank ?? undefined
  const pitchAccent     = vocabFields?.pitchAccent  ?? undefined

  const isPremadeSource = card !== null && card !== undefined && (card as { userId?: string | null }).userId === null
  const isSuspended     = card?.isSuspended === true
  const isFailingCard   = card !== null && card !== undefined && card.lapses >= 8  // matches WEAK_SPOT_THRESHOLD default

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

  const editHref = `/cards/${cardId}/edit`

  return (
    <>
      {/* Minimal TopBar — deck-back + word only. No actions. */}
      <TopBar>
        <Link
          href={`/decks/${deckId}`}
          className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink"
        >
          <span aria-hidden="true">←</span>
          <span className="max-w-32 truncate">{deckName}</span>
        </Link>
        <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
        <span lang="ja" className="flex-1 truncate text-base font-semibold text-sumi-ink">{word}</span>
      </TopBar>

      {/* Vertical centering: this wrapper fills the viewport minus the
          sticky TopBar (h-16 = 4rem) and uses flex to center its child on
          the remaining axis. Falls back to natural scroll when the content
          is taller than the viewport. */}
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center bg-cool-paper-base py-10 lg:py-16">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16">
          {/* Content spans the full 1440px container. */}
          <div className="w-full">

            {/* ── Page header — canonical PageHeader used across the app. */}
            <div className="pb-4 sm:pb-5 lg:pb-6">
              <PageHeader
                kanji="札"
                label="Cards"
                title="Card preview"
                subtitle="This is how this card appears on the back of a review. Edit the fields to change what learners see during practice."
                {...(isSuspended ? {
                  rightSlot: (
                    <span className="rounded-[2px] border border-soft-hairline bg-cream-inset px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
                      Suspended
                    </span>
                  ),
                } : {})}
              />
            </div>

            {/* ── Actions strip right under the header. Mirrors the
                meta strip's single hairline below the card: one rule
                separates page chrome from the card artifact. Ordered
                by intent: modify → inspect → fix → pause → destroy. */}
            {!isLoading && card !== null && card !== undefined && (
              <div className="mb-6 border-b border-soft-hairline pb-4 lg:mb-8">
                <CardActionsStrip
                  editHref={editHref}
                  repairHref={`/cards/${cardId}/repair`}
                  isPremade={isPremadeSource}
                  isSuspended={isSuspended}
                  historyOpen={showHistory}
                  onMove={() => setActiveDialog({ kind: 'move' })}
                  onToggleHistory={() => setShowHistory((v) => !v)}
                  onSuspend={() => setActiveDialog({ kind: 'suspend' })}
                  onDelete={() => setActiveDialog({ kind: 'delete' })}
                />
              </div>
            )}

            {/* ── Body: the card itself ───────────────────────────── */}
            <div className="space-y-6 lg:space-y-8">
              {isLoading && <LoadingBody />}

              {!isLoading && card !== null && card !== undefined && (
                <SectionCard kanji="札" label="Card back" omitTitle>
                  <div className="px-1 pt-5 pb-2 md:px-2 md:pt-7 md:pb-3">
                    <CardBack card={card as unknown as ApiDueCard} />
                  </div>
                </SectionCard>
              )}
            </div>

            {/* ── Meta strip + repair note + history panel (revealed
                when the actions-strip toggle is open). The history
                lives here so the user keeps the card visible while
                inspecting scheduling state below it. */}
            {!isLoading && card !== null && card !== undefined && (
              <div className="mt-10 border-t border-soft-hairline">
                <CardMetaStrip
                  deckName={deckName}
                  jlptLevel={card.jlptLevel}
                  pitch={pitchAccent ?? null}
                  frequencyRank={frequencyRank ?? null}
                  layoutType={card.layoutType}
                  tags={card.tags}
                />

                {isFailingCard && (
                  <p className="mt-3 text-sm text-faded-sumi">
                    This card has lapsed{' '}
                    <span className="text-sumi-ink">{card.lapses}</span>{' '}
                    times. {' '}
                    <Link
                      href={`/cards/${cardId}/repair`}
                      className="text-inari-vermillion-deep underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
                    >
                      Repair recommended
                    </Link>
                    .
                  </p>
                )}

                {showHistory && (
                  <div
                    id="card-history-panel"
                    className="mt-5 rounded-[2px] border border-soft-hairline bg-warm-paper-raised p-4 sm:p-5"
                  >
                    <FsrsStats card={card} />
                  </div>
                )}
              </div>
            )}
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

      {devPanel}
    </>
  )
}

// ─── Sub-views ───────────────────────────────────────────────────────────

function CardMetaStrip({
  deckName,
  jlptLevel,
  pitch,
  frequencyRank,
  layoutType,
  tags,
}: {
  deckName:      string
  jlptLevel:     ApiCard['jlptLevel']
  pitch:         string | null
  frequencyRank: number | null
  layoutType:    ApiCard['layoutType']
  tags:          readonly string[]
}): React.JSX.Element {
  const items: { label: string; value: string }[] = [
    { label: 'Deck', value: deckName },
    ...(jlptLevel     !== null ? [{ label: 'JLPT',  value: jlptLevel              }] : []),
    ...(pitch         !== null ? [{ label: 'Pitch', value: pitch                  }] : []),
    ...(frequencyRank !== null ? [{ label: 'Freq',  value: `#${frequencyRank}`    }] : []),
    { label: 'Type', value: layoutType },
    ...(tags.length > 0 ? [{ label: 'Tags', value: tags.join(', ') }] : []),
  ]

  return (
    <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-faded-sumi">
      {items.map((item, i) => (
        <span key={item.label} className="inline-flex items-baseline gap-1.5">
          <span className="uppercase tracking-[0.12em]">{item.label}</span>
          <span className="text-sumi-ink/80">{item.value}</span>
          {i < items.length - 1 && (
            <span aria-hidden="true" className="text-faded-sumi/55">·</span>
          )}
        </span>
      ))}
    </p>
  )
}

function CardActionsStrip({
  editHref,
  repairHref,
  isPremade,
  isSuspended,
  historyOpen,
  onMove,
  onToggleHistory,
  onSuspend,
  onDelete,
}: {
  editHref:        string
  repairHref:      string
  isPremade:       boolean
  isSuspended:     boolean
  historyOpen:     boolean
  onMove:          () => void
  onToggleHistory: () => void
  onSuspend:       () => void
  onDelete:        () => void
}): React.JSX.Element {
  const dot = <span aria-hidden="true" className="text-faded-sumi/55">·</span>
  // Ordered by intent: modify content → modify placement → inspect →
  // fix → pause → destroy. Delete sits last as the destructive landing.
  return (
    <nav
      aria-label="Card actions"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
    >
      <ActionLink
        href={editHref}
        disabled={isPremade}
        {...(isPremade ? { title: 'Premade cards can’t be edited directly' } : {})}
      >
        Edit
      </ActionLink>
      {dot}
      <ActionButton onClick={onMove} disabled={isPremade}>Move to another deck</ActionButton>
      {dot}
      <ActionButton
        onClick={onToggleHistory}
        ariaExpanded={historyOpen}
        ariaControls="card-history-panel"
      >
        {historyOpen ? 'Hide history' : 'Show history'}
      </ActionButton>
      {dot}
      <ActionLink href={repairHref}>Repair</ActionLink>
      {dot}
      <ActionButton onClick={onSuspend}>{isSuspended ? 'Unsuspend' : 'Suspend'}</ActionButton>
      {dot}
      <ActionButton onClick={onDelete} danger disabled={isPremade}>Delete</ActionButton>
    </nav>
  )
}

function ActionLink({
  href,
  disabled,
  title,
  children,
}: {
  href:     string
  disabled?: boolean
  title?:   string
  children: React.ReactNode
}): React.JSX.Element {
  if (disabled === true) {
    return (
      <span
        className="cursor-not-allowed text-faded-sumi/70"
        title={title}
        aria-disabled="true"
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="ui-motion-colors text-sumi-ink underline-offset-2 hover:text-inari-vermillion-deep hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
    >
      {children}
    </Link>
  )
}

function ActionButton({
  onClick,
  disabled,
  danger,
  ariaExpanded,
  ariaControls,
  children,
}: {
  onClick:       () => void
  disabled?:     boolean
  danger?:       boolean
  ariaExpanded?: boolean
  ariaControls?: string
  children:      React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(ariaExpanded !== undefined ? { 'aria-expanded': ariaExpanded } : {})}
      {...(ariaControls !== undefined ? { 'aria-controls': ariaControls } : {})}
      className={[
        'ui-motion-colors underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:text-faded-sumi/70 disabled:no-underline disabled:hover:no-underline',
        danger === true ? 'text-inari-vermillion-deep hover:text-inari-vermillion' : 'text-sumi-ink hover:text-inari-vermillion-deep',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function LoadingBody(): React.JSX.Element {
  return (
    <SectionCard kanji="例" label="Loading">
      <div className="space-y-3">
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

// `State` is imported for type breadth (FsrsStats consumes the enum at
// runtime). The `void` suppresses an unused-import lint while preserving
// the symbol for future extension here.
void State
