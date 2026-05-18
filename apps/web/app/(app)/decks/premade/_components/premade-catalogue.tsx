'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ApiDeck, ApiPremadeDeck, DeckType, JLPTLevel } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { ContentTypePill, JlptPill, StatusPill, type ContentTypeTone } from '@/components/ui/Pill'
import { QuietLink } from '@/components/ui/QuietLink'
import { Skeleton } from '@/components/ui/Skeleton'
import { SectionCard } from '@/components/ui/SectionCard'
import { Toast, useToast } from '@/components/ui/Toast'
import { useDecks } from '@/lib/api/decks'
import { useCopyPremadeDeck, usePremadeDecks } from '@/lib/api/premade'

// ── Filter dimensions ────────────────────────────────────────────────────────

type JlptFilter = 'all' | JLPTLevel
type TypeFilter = 'all' | DeckType

const JLPT_ORDER: ReadonlyArray<JlptFilter> = ['all', 'N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt']
const TYPE_OPTIONS: ReadonlyArray<TypeFilter> = ['all', 'vocabulary', 'kanji', 'mixed']

const JLPT_LABEL: Record<JlptFilter, string> = {
  all:         'Any level',
  N5:          'N5',
  N4:          'N4',
  N3:          'N3',
  N2:          'N2',
  N1:          'N1',
  beyond_jlpt: 'Beyond',
}

const TYPE_LABEL: Record<TypeFilter, string> = {
  all:        'All types',
  vocabulary: 'Vocabulary',
  kanji:      'Kanji',
  mixed:      'Mixed',
}

const TYPE_PILL_TONE: Record<DeckType, ContentTypeTone> = {
  vocabulary: 'vocabulary',
  kanji:      'kanji',
  mixed:      'mixed',
}

// ── Catalogue ────────────────────────────────────────────────────────────────

/**
 * Premade deck catalogue.
 *
 * Reuses Tomo's standard page chrome — `PageHeader` rhythm via the parent
 * page, `SectionCard` for each entry, `Pill`/`JlptPill`/`ContentTypePill`
 * for metadata, and `Button`/`QuietLink` for actions. Layout mirrors the
 * Decks list: a sticky-aside-free 2-column grid on `lg+` (single column
 * below) so each card reads as a self-contained catalogue entry without
 * crowding.
 *
 * Filters run client-side over the already-fetched list — the catalogue
 * is small enough that paginating server-side wouldn't earn its complexity.
 * Filter state stays in component state (not localStorage): the catalogue
 * is a low-frequency surface, so a fresh visit shows the full view.
 */
export function PremadeCatalogue(): React.JSX.Element {
  const router = useRouter()
  const { toast, showToast, dismissToast } = useToast()

  const [jlpt, setJlpt] = useState<JlptFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')

  const decksQuery = usePremadeDecks()
  const userDecksQuery = useDecks(50)
  const copyMutation = useCopyPremadeDeck()

  // Track the in-flight or just-completed copy by premade deck id so we can
  // disable just the active row while a copy runs (other rows stay clickable).
  const [pendingId, setPendingId] = useState<string | null>(null)

  const allDecks = useMemo(() => decksQuery.data?.items ?? [], [decksQuery.data])

  // Build a `premadeId → user deck` map so each catalogue card can detect
  // whether the learner has already copied that premade entry. Duplicates
  // are allowed under the copy model — when more than one user deck shares
  // a `sourcePremadeId`, we keep the most-recently-created one so the
  // "View deck" link routes somewhere sensible. The catalogue badge stays
  // a binary "in your library" — count is not surfaced here.
  const userDeckByPremadeId = useMemo(() => {
    const map = new Map<string, ApiDeck>()
    const items = userDecksQuery.data?.items ?? []
    for (const deck of items) {
      if (deck.sourcePremadeId === null) continue
      const existing = map.get(deck.sourcePremadeId)
      if (existing === undefined || deck.createdAt > existing.createdAt) {
        map.set(deck.sourcePremadeId, deck)
      }
    }
    return map
  }, [userDecksQuery.data])

  const filteredDecks = useMemo(() => {
    return allDecks.filter((deck) => {
      if (jlpt !== 'all' && deck.jlptLevel !== jlpt) return false
      if (type !== 'all' && deck.deckType !== type) return false
      return true
    })
  }, [allDecks, jlpt, type])

  function handleCopy(deck: ApiPremadeDeck): void {
    if (pendingId !== null) return
    setPendingId(deck.id)
    copyMutation.mutate(deck.id, {
      onSuccess: (result) => {
        setPendingId(null)
        showToast(
          `Added ${result.cardCount} ${result.cardCount === 1 ? 'card' : 'cards'} from ${deck.name} to your library.`,
        )
      },
      onError: (err) => {
        setPendingId(null)
        showToast(err.message || 'Could not add this deck. Try again in a moment.', 'error')
      },
    })
  }

  function handleViewLibrary(): void {
    router.push('/decks')
  }

  // ── States ────────────────────────────────────────────────────────────────

  if (decksQuery.isError) {
    return (
      <>
        <ErrorState onRetry={() => void decksQuery.refetch()} />
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

  return (
    <>
      <FilterBar
        jlpt={jlpt}
        type={type}
        onJlptChange={setJlpt}
        onTypeChange={setType}
        resultCount={decksQuery.isLoading ? null : filteredDecks.length}
        totalCount={allDecks.length}
      />

      <section
        aria-label="Premade decks"
        aria-busy={decksQuery.isLoading ? true : undefined}
        className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6"
      >
        {decksQuery.isLoading
          ? Array.from({ length: 6 }, (_, i) => <CatalogueCardSkeleton key={i} />)
          : filteredDecks.map((deck) => (
              <CatalogueCard
                key={deck.id}
                deck={deck}
                copiedDeck={userDeckByPremadeId.get(deck.id) ?? null}
                onCopy={() => handleCopy(deck)}
                onViewLibrary={handleViewLibrary}
                pending={pendingId === deck.id}
                disabled={pendingId !== null && pendingId !== deck.id}
              />
            ))}
      </section>

      {!decksQuery.isLoading && filteredDecks.length === 0 && (
        <EmptyState
          hasFilter={jlpt !== 'all' || type !== 'all'}
          onResetFilter={() => {
            setJlpt('all')
            setType('all')
          }}
        />
      )}

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

// ── Filter bar ──────────────────────────────────────────────────────────────

interface FilterBarProps {
  jlpt:          JlptFilter
  type:          TypeFilter
  onJlptChange:  (next: JlptFilter) => void
  onTypeChange:  (next: TypeFilter) => void
  resultCount:   number | null
  totalCount:    number
}

function FilterBar({
  jlpt, type, onJlptChange, onTypeChange, resultCount, totalCount,
}: FilterBarProps): React.JSX.Element {
  const jlptId = useId()
  const typeId = useId()
  const filterActive = jlpt !== 'all' || type !== 'all'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-soft-hairline pb-5">
      <FilterSelect
        id={jlptId}
        label="JLPT"
        value={jlpt}
        onChange={(v) => onJlptChange(coerceJlpt(v))}
        options={JLPT_ORDER.map((v) => ({ value: v, label: JLPT_LABEL[v] }))}
      />

      <FilterSelect
        id={typeId}
        label="Type"
        value={type}
        onChange={(v) => onTypeChange(coerceType(v))}
        options={TYPE_OPTIONS.map((v) => ({ value: v, label: TYPE_LABEL[v] }))}
      />

      <div className="ml-auto flex items-center gap-x-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi tabular-nums">
        <span aria-live="polite">
          {resultCount === null
            ? 'Loading'
            : <><span className="text-sumi-ink">{resultCount}</span> of {totalCount} {totalCount === 1 ? 'deck' : 'decks'}</>
          }
        </span>
        {filterActive && resultCount !== null && (
          <button
            type="button"
            onClick={() => { onJlptChange('all'); onTypeChange('all') }}
            className="ui-motion-colors underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

interface FilterSelectProps {
  id:       string
  label:    string
  value:    string
  onChange: (next: string) => void
  options:  ReadonlyArray<{ value: string; label: string }>
}

function FilterSelect({ id, label, value, onChange, options }: FilterSelectProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-x-2">
      <label
        htmlFor={id}
        className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Catalogue card ──────────────────────────────────────────────────────────

interface CatalogueCardProps {
  deck:          ApiPremadeDeck
  /** The user's most-recently-created deck that was copied from this premade
   *  entry, or `null` when the user hasn't copied it yet. Drives the "In your
   *  library" indicator and the "View deck" affordance. */
  copiedDeck:    ApiDeck | null
  onCopy:        () => void
  onViewLibrary: () => void
  pending:       boolean
  disabled:      boolean
}

function CatalogueCard({
  deck, copiedDeck, onCopy, onViewLibrary, pending, disabled,
}: CatalogueCardProps): React.JSX.Element {
  // Domain pill (e.g. "anime", "business") appears alongside the JLPT/type
  // pills when the catalogue carries one. Keeps the metadata cluster
  // self-describing without forcing a description scan.
  const domain = deck.domain
  const cardCountLabel = `${deck.cardCount.toLocaleString()} ${deck.cardCount === 1 ? 'card' : 'cards'}`
  const isCopied = copiedDeck !== null

  return (
    <SectionCard
      kanji="集"
      label={cardCountLabel}
      omitTitle
    >
      <div className="flex flex-col gap-4">
        {/* Header: name + metadata cluster */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span
              lang="ja"
              aria-hidden="true"
              className="shrink-0 font-display text-xl leading-none text-inari-vermillion translate-y-[0.05em]"
            >
              集
            </span>
            <h2 className="min-w-0 break-words font-display text-lg font-medium text-sumi-ink">
              {deck.name}
            </h2>
            {isCopied && (
              <StatusPill
                status="subscribed"
                label="In your library"
                size="sm"
                className="!rounded-[2px] !leading-tight"
              />
            )}
          </div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi tabular-nums">
            <span className="text-sumi-ink">{deck.cardCount.toLocaleString()}</span>
            {' '}{deck.cardCount === 1 ? 'card' : 'cards'}
          </p>
        </div>

        {/* Metadata pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {deck.jlptLevel !== null && (
            <JlptPill level={deck.jlptLevel} size="sm" />
          )}
          <ContentTypePill type={TYPE_PILL_TONE[deck.deckType]} size="sm" />
          {domain !== null && domain.trim().length > 0 && (
            <span className="inline-flex items-center rounded-full border border-soft-hairline bg-cream-inset px-2 py-0.5 text-xs font-medium text-faded-sumi">
              {domain}
            </span>
          )}
        </div>

        {/* Description */}
        {deck.description !== null && deck.description.trim().length > 0 && (
          <p className="max-w-[60ch] text-sm leading-relaxed text-faded-sumi">
            {deck.description}
          </p>
        )}

        {/* Actions */}
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-soft-hairline pt-4">
          {isCopied && copiedDeck !== null ? (
            <>
              <Link href={`/decks/${copiedDeck.id}/preview`}>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  aria-label={`View ${deck.name} in your library`}
                >
                  View deck
                </Button>
              </Link>
              <QuietLink
                onClick={onCopy}
                tone="sumi"
                size="sm"
                ariaLabel={`Add another copy of ${deck.name} to your library`}
              >
                {pending ? 'Adding another copy…' : 'Add another copy'}
              </QuietLink>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onCopy}
                loading={pending}
                disabled={disabled}
                aria-label={`Add ${deck.name} to your library`}
              >
                Add to my library
              </Button>
              <QuietLink onClick={onViewLibrary} tone="sumi" size="sm" trailingArrow>
                View my decks
              </QuietLink>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function CatalogueCardSkeleton(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion/40" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-3 w-[6rem]" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="mt-4 h-8 w-40" />
      </div>
    </div>
  )
}

// ── Empty + error ───────────────────────────────────────────────────────────

interface EmptyStateProps {
  hasFilter:     boolean
  onResetFilter: () => void
}

function EmptyState({ hasFilter, onResetFilter }: EmptyStateProps): React.JSX.Element {
  if (hasFilter) {
    return (
      <div className="mt-8 rounded-[2px] border border-soft-hairline bg-cream-inset/55 px-6 py-10 text-center">
        <p className="text-sm font-medium text-sumi-ink">No decks match these filters.</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-sm text-faded-sumi">
          Try a different combination of JLPT level and content type.
        </p>
        <div className="mt-5">
          <Button size="sm" variant="secondary" onClick={onResetFilter}>
            Clear filters
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-[2px] border border-soft-hairline bg-cream-inset/55 px-6 py-10 text-center">
      <p className="text-sm font-medium text-sumi-ink">No premade decks yet.</p>
      <p className="mx-auto mt-1.5 max-w-[48ch] text-sm text-faded-sumi">
        Curated decks land here as Tomo&rsquo;s catalogue grows. In the
        meantime, build your own from a word or sentence.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Link
          href="/add"
          className="ui-motion-pressable inline-flex h-9 items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 text-sm font-medium text-sumi-ink hover:bg-cream-inset hover:border-faded-sumi focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          Add Japanese
        </Link>
      </div>
    </div>
  )
}

interface ErrorStateProps {
  onRetry: () => void
}

function ErrorState({ onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mt-6 rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
    >
      <p className="font-medium">Couldn&rsquo;t load the catalogue.</p>
      <p className="mt-1 text-error-deep/80">
        Check your connection and try again.
      </p>
      <div className="mt-4">
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

// ── Filter coercion ─────────────────────────────────────────────────────────
// Narrow `string` (the native select callback value) back to the typed enums.

function coerceJlpt(v: string): JlptFilter {
  return JLPT_ORDER.includes(v as JlptFilter) ? (v as JlptFilter) : 'all'
}

function coerceType(v: string): TypeFilter {
  return TYPE_OPTIONS.includes(v as TypeFilter) ? (v as TypeFilter) : 'all'
}
