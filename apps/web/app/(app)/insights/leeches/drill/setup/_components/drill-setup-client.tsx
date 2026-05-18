'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { useDecks } from '@/lib/api/decks'
import {
  useCreateDrillSessionMutation,
  useLeechesQuery,
} from '@/lib/api/leeches'
import type { CreateDrillSessionInput } from '@/lib/actions/leeches.actions'

// ── Source picker shapes ──────────────────────────────────────────────────────

type DrillSource =
  | { kind: 'unresolvedLeeches' }
  | { kind: 'deckScoped'; deckId: string }
  | { kind: 'highLapseCandidates'; minLapses: number }
  | { kind: 'currentCard'; cardId: string }

type LimitOption = 5 | 10 | 20

const LIMIT_OPTIONS: ReadonlyArray<LimitOption> = [5, 10, 20]

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Drill setup screen. Three jobs:
 *   1. Pick the source (unresolved leeches / deck-scoped / high-lapse / one
 *      specific card from a deeplink).
 *   2. Pick the limit (5 / 10 / 20).
 *   3. Press Start. POSTs to /api/v1/leeches/drill-sessions, then routes to
 *      /insights/leeches/drill/[sessionId].
 *
 * `?cardId=` deeplinks the current-card flow so the Drill button on a
 * leech row routes straight to a one-card session entry point. The picker
 * pre-selects the matching source; the learner can still change it.
 *
 * Copy register honors the doc's voice rules:
 *   - "Practice only. Your review schedule stays as it is."
 *   - Drill labels avoid "FSRS metrics will not be contaminated."
 */
export function DrillSetupClient(): React.JSX.Element {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const deeplinkCardId = searchParams.get('cardId')

  const [source, setSource] = useState<DrillSource>(
    deeplinkCardId !== null
      ? { kind: 'currentCard', cardId: deeplinkCardId }
      : { kind: 'unresolvedLeeches' },
  )
  const [limit, setLimit] = useState<LimitOption>(10)

  const decksQuery = useDecks(50)
  const decks      = decksQuery.data?.items ?? []

  const leechesQuery = useLeechesQuery({ status: 'unresolved', limit: 50 })
  const unresolvedCount = leechesQuery.data?.items.length ?? 0
  const unresolvedHasMore = leechesQuery.data?.hasMore ?? false
  const unresolvedLabel =
    unresolvedHasMore
      ? `${unresolvedCount}+ unresolved leeches in your pile`
      : unresolvedCount === 0
        ? 'No unresolved leeches right now'
        : `${unresolvedCount} unresolved ${unresolvedCount === 1 ? 'leech' : 'leeches'} in your pile`

  const createMutation = useCreateDrillSessionMutation()

  const canStart = !createMutation.isPending && estimateSize(source, unresolvedCount, limit) > 0

  function handleStart(): void {
    const input = buildPayload(source, limit)
    createMutation.mutate(input, {
      onSuccess: (session) => {
        router.push(`/insights/leeches/drill/${session.sessionId}`)
      },
    })
  }

  const estimatedCards = estimateSize(source, unresolvedCount, limit)

  return (
    <div className="flex flex-1 flex-col">
      <TopChrome />

      <div className="mx-auto w-full max-w-[800px] flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <PageHeader
          kanji="蛭"
          label="Drill setup"
          title="Practice your weak spots."
          subtitle="A focused, schedule-safe drill. Your review timing stays exactly as it is."
        />

        <div className="mt-8 flex flex-col gap-y-6">
          {/* Source */}
          <SectionCard
            id="drill-source"
            kanji="源"
            label="Source"
            description="Which cards should this drill pull from?"
            variant="compact"
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Drill source</legend>
              <SourceOption
                checked={source.kind === 'unresolvedLeeches'}
                onSelect={() => setSource({ kind: 'unresolvedLeeches' })}
                label="Unresolved leeches"
                description={unresolvedLabel}
              />
              <SourceOption
                checked={source.kind === 'deckScoped'}
                onSelect={() =>
                  setSource((prev) =>
                    prev.kind === 'deckScoped'
                      ? prev
                      : { kind: 'deckScoped', deckId: decks[0]?.id ?? '' },
                  )
                }
                label="Deck-scoped"
                description="Only leeches in a deck you pick"
              >
                {source.kind === 'deckScoped' && (
                  <select
                    aria-label="Deck"
                    value={source.deckId}
                    onChange={(e) =>
                      setSource({ kind: 'deckScoped', deckId: e.currentTarget.value })
                    }
                    className="mt-3 w-full max-w-[20rem] rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
                  >
                    {decks.length === 0 && (
                      <option value="">No decks yet</option>
                    )}
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </SourceOption>
              <SourceOption
                checked={source.kind === 'highLapseCandidates'}
                onSelect={() =>
                  setSource((prev) =>
                    prev.kind === 'highLapseCandidates' ? prev : { kind: 'highLapseCandidates', minLapses: 3 },
                  )
                }
                label="High-lapse candidates"
                description="Cards near the leech threshold, even if not flagged yet"
              >
                {source.kind === 'highLapseCandidates' && (
                  <div className="mt-3 flex items-center gap-3 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-faded-sumi">
                    <span>Minimum lapses</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={source.minLapses}
                      onChange={(e) => {
                        const next = Number.parseInt(e.currentTarget.value, 10)
                        if (!Number.isFinite(next)) return
                        setSource({ kind: 'highLapseCandidates', minLapses: Math.min(20, Math.max(1, next)) })
                      }}
                      className="h-8 w-16 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-2 text-center text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
                    />
                  </div>
                )}
              </SourceOption>
              {deeplinkCardId !== null && (
                <SourceOption
                  checked={source.kind === 'currentCard'}
                  onSelect={() => setSource({ kind: 'currentCard', cardId: deeplinkCardId })}
                  label="Just this card"
                  description="A focused single-card drill from where you came from"
                />
              )}
            </fieldset>
          </SectionCard>

          {/* Limit */}
          <SectionCard
            id="drill-limit"
            kanji="量"
            label="Session size"
            description="Keep it bounded. You can always run another."
            variant="compact"
          >
            <div
              role="radiogroup"
              aria-label="Session size"
              className="flex flex-wrap gap-2"
            >
              {LIMIT_OPTIONS.map((opt) => {
                const active = opt === limit
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLimit(opt)}
                    className={[
                      'min-w-[5rem] rounded-[2px] border px-4 py-2',
                      'font-mono text-[0.75rem] uppercase tracking-[0.14em]',
                      'transition-colors',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                      active
                        ? 'border-inari-vermillion bg-vermillion-wash text-inari-vermillion-deep'
                        : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-sumi-ink hover:text-sumi-ink',
                    ].join(' ')}
                  >
                    {opt} cards
                  </button>
                )
              })}
            </div>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-faded-sumi">
              Missed cards return later in the same session after a small lag.
            </p>
          </SectionCard>

          {/* Promise band */}
          <div
            role="note"
            className="rounded-[2px] border border-dashed border-inari-vermillion/45 bg-vermillion-wash/40 px-4 py-3"
          >
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep">
              Practice only · Review schedule unchanged
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-sumi-ink">
              These cards are for practice. Your review schedule stays as it is.
              Remembered cards can be marked resolved when they feel steady.
            </p>
          </div>

          {/* Start */}
          <div className="flex flex-wrap items-center gap-3 border-t border-soft-hairline pt-6">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleStart}
              loading={createMutation.isPending}
              disabled={!canStart}
            >
              {estimatedCards === 0
                ? 'Nothing to drill'
                : `Start drill · up to ${Math.min(limit, estimatedCards)} ${Math.min(limit, estimatedCards) === 1 ? 'card' : 'cards'}`}
            </Button>
            <QuietLink href="/insights/leeches" tone="sumi" size="sm">
              Cancel
            </QuietLink>
            {createMutation.isError && (
              <p role="alert" className="basis-full text-sm text-error-deep">
                {createMutation.error.message ?? 'Couldn’t start that drill.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function TopChrome(): React.JSX.Element {
  return (
    <header
      role="banner"
      aria-label="Drill setup"
      className="border-b border-soft-hairline bg-warm-paper-raised"
    >
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6">
        <Link
          href="/insights/leeches"
          className="flex items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          <span aria-hidden="true">←</span>
          <span>Back to Leeches</span>
        </Link>
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep">
          Practice only
        </p>
      </div>
    </header>
  )
}

interface SourceOptionProps {
  checked:     boolean
  onSelect:    () => void
  label:       string
  description: string
  children?:   React.ReactNode
}

function SourceOption({
  checked,
  onSelect,
  label,
  description,
  children,
}: SourceOptionProps): React.JSX.Element {
  return (
    <label
      className={[
        'flex cursor-pointer flex-col rounded-[2px] border px-4 py-3 transition-colors',
        checked
          ? 'border-inari-vermillion bg-vermillion-wash/40'
          : 'border-soft-hairline hover:border-sumi-ink',
      ].join(' ')}
    >
      <span className="flex items-start gap-3">
        <input
          type="radio"
          name="drill-source"
          checked={checked}
          onChange={onSelect}
          className="mt-1 h-3.5 w-3.5 accent-inari-vermillion"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium text-sumi-ink">{label}</span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-faded-sumi">
            {description}
          </span>
        </span>
      </span>
      {checked && children !== undefined && <div className="ml-7">{children}</div>}
    </label>
  )
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function buildPayload(source: DrillSource, limit: LimitOption): CreateDrillSessionInput {
  if (source.kind === 'unresolvedLeeches') {
    return { source: 'unresolvedLeeches', limit, repeatPolicy: 'missedAfterLag', order: 'mostLapses' }
  }
  if (source.kind === 'deckScoped') {
    return {
      source:       'deckScoped',
      deckId:       source.deckId,
      limit,
      repeatPolicy: 'missedAfterLag',
      order:        'mostLapses',
    }
  }
  if (source.kind === 'highLapseCandidates') {
    return {
      source:       'highLapseCandidates',
      minLapses:    source.minLapses,
      limit,
      repeatPolicy: 'missedAfterLag',
      order:        'mostLapses',
    }
  }
  return {
    source:       'currentCard',
    cardId:       source.cardId,
    limit,
    repeatPolicy: 'missedAfterLag',
  }
}

function estimateSize(
  source:           DrillSource,
  unresolvedCount:  number,
  limit:            LimitOption,
): number {
  if (source.kind === 'unresolvedLeeches') return Math.min(unresolvedCount, limit)
  if (source.kind === 'currentCard')       return 1
  // We don't have client-side counts for deck-scoped or high-lapse without a
  // separate query; assume at least 1 card so the button can fire. The
  // server will return an empty queue if nothing matches, and the session
  // page handles that empty-queue case.
  return limit
}
