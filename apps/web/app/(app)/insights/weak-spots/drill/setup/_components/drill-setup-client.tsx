'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar'
import { cn } from '@/lib/utils'
import { useDecks } from '@/lib/api/decks'
import {
  useCreateDrillSessionMutation,
  useWeakSpotsQuery,
} from '@/lib/api/weak-spots'
import type { CreateDrillSessionInput } from '@/lib/actions/weak-spots.actions'

import {
  DRILL_ATTEMPT_FIXTURES,
  DRILL_SESSION_FIXTURES,
  devSessionHref,
} from '../../_components/drill-fixtures'

// ── Source picker shapes ──────────────────────────────────────────────────────

type DrillSource =
  | { kind: 'unresolvedLeeches' }
  | { kind: 'deckScoped'; deckId: string }
  | { kind: 'highLapseCandidates'; minLapses: number }
  | { kind: 'currentCard'; cardId: string }

type LimitOption = 5 | 10 | 20

const LIMIT_OPTIONS: ReadonlyArray<LimitOption> = [5, 10, 20]

// ── Page ──────────────────────────────────────────────────────────────────────
//
// Visual 1-to-1 copy of `/review/setup`. Same outer flex / inner grid
// scaffolding, same PageHeader, same sticky-aside summary + right-column
// SectionCards layout, same MobileStickyActionBar pattern. The drill-only
// differences are:
//
//   - The aside summary (`DrillSetupSummary`) reports estimated cards, source
//     label, and limit — drill doesn't have a queue breakdown the way review
//     does, and doesn't budget by seconds.
//   - Right-column control cards are Source + Session size (3-row source
//     picker + 3-chip limit picker) instead of review's deck list + tuning
//     controls.
//
// `?cardId=` deeplinks the current-card flow so the Drill button on a
// weak-spot row routes straight to a one-card session entry point.

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

  const weakSpotsQuery   = useWeakSpotsQuery({ status: 'unresolved', limit: 50 })
  const unresolvedCount   = weakSpotsQuery.data?.items.length ?? 0
  const unresolvedHasMore = weakSpotsQuery.data?.hasMore ?? false
  const unresolvedLabel =
    unresolvedHasMore
      ? `${unresolvedCount}+ unresolved weak spots in your pile`
      : unresolvedCount === 0
        ? 'No unresolved weak spots right now'
        : `${unresolvedCount} unresolved ${unresolvedCount === 1 ? 'weak spot' : 'weak spots'} in your pile`

  const createMutation = useCreateDrillSessionMutation()

  const estimatedCards = estimateSize(source, unresolvedCount, limit)
  const canStart = !createMutation.isPending && estimatedCards > 0

  function handleStart(): void {
    const input = buildPayload(source, limit)
    createMutation.mutate(input, {
      onSuccess: (session) => {
        router.push(`/insights/weak-spots/drill/${session.sessionId}`)
      },
    })
  }

  const sourceLabel = describeSource(source, decks)
  const startLabel  = estimatedCards === 0
    ? 'Nothing to drill'
    : `Start drill · up to ${Math.min(limit, estimatedCards)} ${Math.min(limit, estimatedCards) === 1 ? 'card' : 'cards'}`

  // Action area is shared between the desktop sticky aside and the mobile
  // sticky action bar, exactly as review setup does it.
  const actions = (
    <ActionArea
      canStart={canStart}
      startLabel={startLabel}
      onStart={handleStart}
      pending={createMutation.isPending}
      error={createMutation.isError ? (createMutation.error?.message ?? 'Couldn’t start that drill.') : null}
    />
  )

  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div className="relative z-10 grid flex-1 grid-cols-1 content-center gap-y-8 mx-auto w-full max-w-[1440px] px-6 pt-8 md:px-12 md:pt-10 lg:px-16 lg:pt-12">
        <PageHeader
          kanji="弱"
          label="Drill setup"
          title="Practice your weak spots."
          subtitle="A focused, schedule-safe drill. Your review timing stays exactly as it is."
        />

        {process.env.NODE_ENV === 'development' && <DevFixtureLauncher />}

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:col-span-5 lg:sticky lg:top-10 lg:self-start">
            <DrillSetupSummary
              estimated={estimatedCards}
              limit={limit}
              sourceLabel={sourceLabel}
              actions={actions}
            />
          </aside>

          <div className="lg:col-span-7">
            <div className="flex flex-col gap-y-6">
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
                    label="Unresolved weak spots"
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
                    description="Only weak spots in a deck you pick"
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
                    description="Cards near the weak-spot threshold, even if not flagged yet"
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
                        className={cn(
                          'min-w-[5rem] rounded-[2px] border px-4 py-2',
                          'font-mono text-[0.75rem] uppercase tracking-[0.14em]',
                          'transition-colors',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                          active
                            ? 'border-inari-vermillion bg-vermillion-wash text-inari-vermillion-deep'
                            : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-sumi-ink hover:text-sumi-ink',
                        )}
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
            </div>
          </div>
        </div>
      </div>

      <MobileStickyActionBar ariaLabel="Start drill session">
        {actions}
      </MobileStickyActionBar>
    </div>
  )
}

// ── Sticky aside summary ─────────────────────────────────────────────────────

interface DrillSetupSummaryProps {
  estimated:   number
  limit:       LimitOption
  sourceLabel: string
  actions:     React.ReactNode
}

// Mirrors `SetupSummary`'s SectionCard chrome (vermillion stripe, kanji
// ornament, small-caps mono label, hairline-separated stat grid, action area
// at the bottom that's hidden on mobile because the MobileStickyActionBar
// owns it). Drill-flavored stats: estimated cards, source, limit.

function DrillSetupSummary({
  estimated,
  limit,
  sourceLabel,
  actions,
}: DrillSetupSummaryProps): React.JSX.Element {
  return (
    <SectionCard
      id="drill-setup-summary"
      kanji="弱"
      label="This drill"
    >
      <p className="text-sm leading-relaxed text-faded-sumi">
        <span className="text-sumi-ink">Practice only.</span>{' '}
        Your review schedule stays exactly as it is.
      </p>

      <dl
        className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-soft-hairline/70 pt-5"
        aria-live="polite"
      >
        <StatPair label="Cards" value={estimated === 0 ? '0' : String(estimated)} />
        <StatPair label="Limit" value={`${limit}`} />
        <div className="col-span-2 flex flex-col">
          <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
            Source
          </dt>
          <dd className="mt-1 text-sm text-sumi-ink">{sourceLabel}</dd>
        </div>
      </dl>

      <div className="mt-6 hidden lg:block">
        {actions}
      </div>
    </SectionCard>
  )
}

function StatPair({
  label,
  value,
}: {
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </dt>
      <dd className="mt-1 font-display text-[1.25rem] leading-none tabular-nums text-sumi-ink">
        {value}
      </dd>
    </div>
  )
}

// ── Action area ──────────────────────────────────────────────────────────────

interface ActionAreaProps {
  canStart:    boolean
  startLabel:  string
  onStart:     () => void
  pending:     boolean
  error:       string | null
}

function ActionArea({
  canStart,
  startLabel,
  onStart,
  pending,
  error,
}: ActionAreaProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onStart}
          loading={pending}
          disabled={!canStart}
        >
          {startLabel}
        </Button>
        <QuietLink href="/insights/weak-spots" tone="sumi" size="sm">
          Cancel
        </QuietLink>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-error-deep">{error}</p>
      )}
    </div>
  )
}

// ── Source option ────────────────────────────────────────────────────────────

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
      className={cn(
        'flex cursor-pointer flex-col rounded-[2px] border px-4 py-3 transition-colors',
        checked
          ? 'border-inari-vermillion bg-vermillion-wash/40'
          : 'border-soft-hairline hover:border-sumi-ink',
      )}
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

// ── Dev fixture launcher (development only) ──────────────────────────────────

function DevFixtureLauncher(): React.JSX.Element {
  return (
    <div className="rounded-[2px] border border-dashed border-sumi-ink/35 bg-cream-inset/40 px-4 py-3">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-sumi-ink/70">
        Dev · Drill fixtures
      </p>
      <p className="mt-1 text-[0.8125rem] leading-snug text-faded-sumi">
        Skip the API and jump straight into a fixture-backed drill (or summary). Renders only in development.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DRILL_SESSION_FIXTURES.map((f) => (
          <Link
            key={f.key}
            href={devSessionHref(f.key)}
            title={f.description}
            className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-sumi-ink transition-colors hover:border-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            {f.label}
          </Link>
        ))}
      </div>
      <p className="mt-4 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-sumi-ink/70">
        Or jump to a pre-baked summary:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DRILL_ATTEMPT_FIXTURES.map((f) => (
          <Link
            key={f.key}
            href={`${devSessionHref('mixed')}/summary?seed=${f.key}`}
            title={f.description}
            className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-sumi-ink transition-colors hover:border-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            Summary · {f.label}
          </Link>
        ))}
      </div>
    </div>
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
  return limit
}

function describeSource(
  source: DrillSource,
  decks:  ReadonlyArray<{ id: string; name: string }>,
): string {
  if (source.kind === 'unresolvedLeeches')   return 'Unresolved weak spots'
  if (source.kind === 'highLapseCandidates') return `High-lapse (≥ ${source.minLapses} lapses)`
  if (source.kind === 'currentCard')         return 'A single card'
  const deck = decks.find((d) => d.id === source.deckId)
  return deck !== undefined ? `Deck: ${deck.name}` : 'Deck: unselected'
}
