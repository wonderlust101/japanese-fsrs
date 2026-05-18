'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Toast, useToast } from '@/components/ui/Toast'
import { CardBack } from '@/components/review/session/CardBack'
import { getCardByIdAction } from '@/lib/actions/cards.actions'
import {
  useForgetCardMutation,
  useRescheduleCardMutation,
} from '@/lib/api/cards'
import { queryKeys } from '@/lib/api/queryKeys'
import {
  getWordFields,
  getSentenceFrontBack,
  type ApiDueCard,
} from '@fsrs-japanese/shared-types'

interface Props {
  cardId:   string
  deckId:   string
  deckName: string
}

type ActiveDialog = { kind: 'none' } | { kind: 'forget' } | { kind: 'reschedule' }

export function RepairView({ cardId, deckId, deckName }: Props): React.JSX.Element {
  const router = useRouter()
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: 'none' })
  const [resetCount,   setResetCount]   = useState(false)
  const { toast, showToast, dismissToast } = useToast()

  // Re-read the card client-side so the preview reflects the latest FSRS
  // state after a successful repair without a full route refresh.
  const { data: card, isLoading } = useQuery({
    queryKey: queryKeys.cards.detail(cardId),
    queryFn:  () => getCardByIdAction(cardId),
  })

  const forgetMutation     = useForgetCardMutation()
  const rescheduleMutation = useRescheduleCardMutation()

  const word = card != null
    ? (getWordFields(card)?.word ?? getSentenceFrontBack(card)?.front ?? 'this card')
    : 'this card'

  function closeDialog(): void {
    if (forgetMutation.isPending || rescheduleMutation.isPending) return
    setActiveDialog({ kind: 'none' })
    forgetMutation.reset()
    rescheduleMutation.reset()
  }

  function handleForget(): void {
    const variables = resetCount ? { cardId, resetCount: true } : { cardId }
    forgetMutation.mutate(variables, {
      onSuccess: () => {
        setActiveDialog({ kind: 'none' })
        showToast('Card forgotten.')
        router.push(`/cards/${cardId}`)
      },
    })
  }

  function handleReschedule(): void {
    rescheduleMutation.mutate(cardId, {
      onSuccess: () => {
        setActiveDialog({ kind: 'none' })
        showToast('Schedule recomputed.')
        router.push(`/cards/${cardId}`)
      },
    })
  }

  return (
    <>
      <TopBar>
        <Link
          href={`/cards/${cardId}`}
          className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink"
        >
          <span aria-hidden="true">←</span>
          <span className="max-w-32 truncate">{deckName}</span>
        </Link>
        <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
        <span lang="ja" className="flex-1 truncate text-base font-semibold text-sumi-ink">{word}</span>
      </TopBar>

      <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-cool-paper-base py-10 lg:py-16">
        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="pb-4 sm:pb-5 lg:pb-6">
            <PageHeader
              kanji="直"
              label="Repair"
              title="Repair this card."
              subtitle="Forget rewinds FSRS scheduling and queues the card as new. Reschedule replays the review log and recomputes the schedule. Both leave the original review log intact."
            />
          </div>

          {/* Card preview — same artifact the user is about to act on. */}
          <div className="space-y-6 lg:space-y-8">
            {isLoading && (
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
            )}

            {!isLoading && card !== null && card !== undefined && (
              <SectionCard kanji="札" label="Card back" omitTitle>
                <div className="px-1 pt-5 pb-2 md:px-2 md:pt-7 md:pb-3">
                  <CardBack card={card as unknown as ApiDueCard} />
                </div>
              </SectionCard>
            )}

            <SectionCard
              kanji="直"
              label="Repair actions"
              description="Two ways to reset this card's scheduling. Both keep the review log."
            >
              <ul className="flex flex-col divide-y divide-soft-hairline">
                <RepairAction
                  title="Forget"
                  description="Resets FSRS scheduling and re-queues the card as new. Lapses and reps stay on the record unless you opt in."
                  buttonLabel="Forget card"
                  onClick={() => setActiveDialog({ kind: 'forget' })}
                  disabled={card == null}
                />
                <RepairAction
                  title="Reschedule"
                  description="Replays the card's review history and recomputes scheduling from scratch. Use this after a long absence or when the schedule feels off."
                  buttonLabel="Reschedule card"
                  onClick={() => setActiveDialog({ kind: 'reschedule' })}
                  disabled={card == null}
                />
              </ul>
            </SectionCard>
          </div>
        </div>
      </div>

      <Dialog
        open={activeDialog.kind === 'forget'}
        onClose={closeDialog}
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
            <span className="block text-xs text-faded-sumi">Zeroes reps + lapses. Off by default so the card's history stays in your analytics.</span>
          </span>
        </label>
        {forgetMutation.isError && (
          <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
            {forgetMutation.error?.message ?? 'Unknown error'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeDialog} disabled={forgetMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={forgetMutation.isPending}
            onClick={handleForget}
          >
            Forget card
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={activeDialog.kind === 'reschedule'}
        onClose={closeDialog}
        title="Reschedule card"
      >
        <p className="mb-5 text-sm text-faded-sumi">
          Replay{' '}
          <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>'s
          review history and recompute its schedule from scratch. This won't
          change your review log.
        </p>
        {rescheduleMutation.isError && (
          <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
            {rescheduleMutation.error?.message ?? 'Unknown error'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeDialog} disabled={rescheduleMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={rescheduleMutation.isPending}
            onClick={handleReschedule}
          >
            Reschedule card
          </Button>
        </div>
      </Dialog>

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

  // Suppress unused-var warning if deckId is needed in future
  void deckId
}

interface RepairActionProps {
  title:        string
  description:  string
  buttonLabel:  string
  onClick:      () => void
  disabled?:    boolean
}

function RepairAction({
  title, description, buttonLabel, onClick, disabled,
}: RepairActionProps): React.JSX.Element {
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-medium text-sumi-ink">{title}</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-faded-sumi">{description}</p>
      </div>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={onClick}
        disabled={disabled === true}
        className="sm:shrink-0"
      >
        {buttonLabel}
      </Button>
    </li>
  )
}
