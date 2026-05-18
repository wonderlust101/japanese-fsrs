'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import type { ApiPremadeDeck, JLPTLevel, UpdateProfileInput } from '@fsrs-japanese/shared-types'

import { RecommendedDeckCard } from '@/components/ui/RecommendedDeckCard'
import { DeckSummary } from '@/components/srs/DeckSummary'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOnboardingStore, type OnboardingLevel } from '@/stores/onboarding.store'
import { usePremadeDecks } from '@/lib/api/premade'
import { updateProfileAction } from '@/lib/actions/profile.actions'
import type { JlptPillLevel } from '@/components/ui/Pill'

import { StepCard, StepChild } from '../_components/step-card'
import { StepFooter } from '../_components/step-footer'

const SCHEDULE_TO_CARD_LIMIT: Record<string, number> = {
  light:     5,
  steady:    20,
  intensive: 50,
}

interface RecommendedDeck {
  id:          string
  name:        string
  description: string
  /** Tone for the level pill; uses 'kana' (neutral) for level-agnostic decks
   *  (e.g. Joyo Kanji) so they don't borrow a JLPT-specific color. */
  level:       JlptPillLevel
  levelLabel:  string
  count:       number
}

/**
 * Maps the onboarding level (the user's self-reported current ability) to the
 * set of premade JLPT levels worth recommending. The user picks a single
 * level, so we surface that level's vocabulary deck plus any level-agnostic
 * decks (Joyo Kanji etc.). For N1, "Beyond JLPT" is folded in since an N1
 * learner is the natural audience.
 *
 * `null` in the returned set matches catalogue rows with `jlptLevel === null`
 * (Joyo Kanji etc.). 'beyond_jlpt' is a distinct JLPTLevel value, so it
 * only appears in the N1 set explicitly.
 */
function levelTargets(level: OnboardingLevel | null): ReadonlySet<JLPTLevel | null> {
  // Beginner maps to N5 — same downstream mapping the page already uses when
  // POSTing the profile (see handleContinue).
  switch (level) {
    case 'N5':       return new Set<JLPTLevel | null>(['N5', null])
    case 'N4':       return new Set<JLPTLevel | null>(['N4', null])
    case 'N3':       return new Set<JLPTLevel | null>(['N3', null])
    case 'N2':       return new Set<JLPTLevel | null>(['N2', null])
    case 'N1':       return new Set<JLPTLevel | null>(['N1', 'beyond_jlpt', null])
    case 'beginner': return new Set<JLPTLevel | null>(['N5', null])
    case null:       return new Set<JLPTLevel | null>(['N5', null])
  }
}

/**
 * Maps an ApiPremadeDeck row onto the UI's RecommendedDeck shape. The pill
 * tone follows the JLPT level when set; level-agnostic decks (jlpt_level
 * NULL — Joyo Kanji etc.) use the 'kana' tone (neutral cream) with a label
 * derived from the deck type so the row still reads at a glance.
 */
function toRecommendedDeck(deck: ApiPremadeDeck): RecommendedDeck {
  if (deck.jlptLevel !== null) {
    const label = deck.jlptLevel === 'beyond_jlpt' ? 'Beyond' : deck.jlptLevel
    return {
      id:          deck.id,
      name:        deck.name,
      description: deck.description ?? '',
      level:       deck.jlptLevel,
      levelLabel:  label,
      count:       deck.cardCount,
    }
  }
  // Level-agnostic catalogue entries — neutral pill + content-type label.
  const fallbackLabel = deck.deckType === 'kanji'
    ? 'Kanji'
    : deck.deckType === 'vocabulary'
      ? 'Vocab'
      : 'Mixed'
  return {
    id:          deck.id,
    name:        deck.name,
    description: deck.description ?? '',
    level:       'kana',
    levelLabel:  fallbackLabel,
    count:       deck.cardCount,
  }
}

/**
 * Sort: JLPT-leveled rows first (the user's chosen level), then the
 * level-agnostic rows (Joyo Kanji, etc.). Inside each group, lower JLPT
 * numbers come first so an "N1" recommendation list reads N1 → Beyond.
 * Empty card-count rows sink to the bottom as a guardrail.
 */
function rankRecommendations(rows: ReadonlyArray<ApiPremadeDeck>): ApiPremadeDeck[] {
  const jlptOrder: Record<JLPTLevel, number> = {
    N5:          1,
    N4:          2,
    N3:          3,
    N2:          4,
    N1:          5,
    beyond_jlpt: 6,
  }
  return [...rows].sort((a, b) => {
    // Empty decks last.
    if (a.cardCount === 0 && b.cardCount > 0) return 1
    if (b.cardCount === 0 && a.cardCount > 0) return -1
    // JLPT-leveled ahead of level-agnostic.
    if (a.jlptLevel === null && b.jlptLevel !== null) return 1
    if (b.jlptLevel === null && a.jlptLevel !== null) return -1
    if (a.jlptLevel !== null && b.jlptLevel !== null) {
      return jlptOrder[a.jlptLevel] - jlptOrder[b.jlptLevel]
    }
    return a.name.localeCompare(b.name)
  })
}

export default function DecksPage(): React.JSX.Element {
  const router           = useRouter()
  const level            = useOnboardingStore((s) => s.level)
  const schedule         = useOnboardingStore((s) => s.schedule)
  const applyAllDefaults = useOnboardingStore((s) => s.actions.applyAllDefaults)
  const reset            = useOnboardingStore((s) => s.actions.reset)

  const premadeDecksQuery = usePremadeDecks()

  // Compute the list of recommended decks from the live catalogue, filtered
  // by the JLPT level the user just chose. `useMemo` keys on the data + level
  // so swapping levels (back-button revisit) re-derives without a refetch.
  const recommendedDecks = useMemo<ReadonlyArray<RecommendedDeck>>(() => {
    const items = premadeDecksQuery.data?.items ?? []
    const target = levelTargets(level)
    const matched = items.filter((d) => target.has(d.jlptLevel))
    return rankRecommendations(matched).map(toRecommendedDeck)
  }, [premadeDecksQuery.data, level])

  // Default-none: the user picks; nothing is pre-decided.
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(
    () => new Set<string>(),
  )
  const subscribedCount = subscribedIds.size

  const totalCards = useMemo(
    () => recommendedDecks.filter((d) => subscribedIds.has(d.id)).reduce((sum, d) => sum + d.count, 0),
    [recommendedDecks, subscribedIds],
  )

  const paceNewPerDay = SCHEDULE_TO_CARD_LIMIT[schedule ?? 'steady'] ?? 20

  function toggleSubscribed(id: string): void {
    setSubscribedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: UpdateProfileInput) => updateProfileAction(payload),
    onSuccess: () => {
      reset()
      router.push('/today')
    },
  })

  const isSkipping = subscribedCount === 0
  const isLoading  = premadeDecksQuery.isLoading

  function handleContinue(): void {
    if (isSkipping) {
      // Skip the deck commitment, go straight to the dashboard. Matches
      // the prior escape-link behavior: profile mutation is reserved for
      // the explicit "Add and begin" path so unfinished onboardings don't
      // land partial answers on the server.
      router.push('/today')
      return
    }

    applyAllDefaults()
    const { level: storedLevel, goal, interests, schedule: pace } = useOnboardingStore.getState()

    const payload: UpdateProfileInput = {
      jlptTarget:         storedLevel === 'beginner' || storedLevel === null ? 'N5' : storedLevel,
      ...(goal !== null ? { studyGoal: goal } : {}),
      interests,
      dailyNewCardsLimit: SCHEDULE_TO_CARD_LIMIT[pace ?? 'steady'] ?? 20,
    }
    mutate(payload)
  }

  return (
    <StepCard
      previewPane={
        <DeckSummary
          allDecks={recommendedDecks}
          subscribedIds={subscribedIds}
          paceNewPerDay={paceNewPerDay}
        />
      }
      heading="Your starter cards"
      subhead="Based on your answers. The summary updates as you toggle decks on or off."
      footer={
        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-error">
              {error.message ?? 'Something went wrong. Please try again.'}
            </p>
          )}

          <StepFooter
            showBack
            isSkipping={isSkipping}
            continueLabel={isSkipping ? "I'll browse decks myself" : 'Add and begin'}
            continueLoading={isPending}
            onContinue={handleContinue}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-2" aria-busy={isLoading ? true : undefined}>
        {isLoading && <RecommendedDeckRowSkeletons />}

        {!isLoading && recommendedDecks.length === 0 && (
          <StepChild>
            <EmptyRecommendationsNotice />
          </StepChild>
        )}

        {!isLoading && recommendedDecks.map((deck) => (
          <StepChild key={deck.id}>
            <RecommendedDeckCard
              name={deck.name}
              description={deck.description}
              level={deck.level}
              levelLabel={deck.levelLabel}
              count={deck.count}
              subscribed={subscribedIds.has(deck.id)}
              onToggle={() => toggleSubscribed(deck.id)}
            />
          </StepChild>
        ))}

        <StepChild>
          <div className="flex items-center justify-between gap-4 pt-3 mt-1 border-t border-soft-hairline">
            <p className="text-xs uppercase tracking-[0.08em] text-faded-sumi font-medium">
              {subscribedCount} {subscribedCount === 1 ? 'deck' : 'decks'} selected
            </p>
            <p className="text-xs text-faded-sumi font-mono tabular-nums">
              {totalCards.toLocaleString()} cards
            </p>
          </div>
        </StepChild>
      </div>
    </StepCard>
  )
}

// ─── Subviews ────────────────────────────────────────────────────────────────

function RecommendedDeckRowSkeletons(): React.JSX.Element {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <StepChild key={i}>
          <div
            className="flex items-center gap-4 rounded-[2px] border border-soft-hairline px-4 py-3"
            aria-hidden="true"
          >
            <Skeleton className="h-5 w-10" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-8 w-16" />
          </div>
        </StepChild>
      ))}
    </>
  )
}

function EmptyRecommendationsNotice(): React.JSX.Element {
  return (
    <div
      role="status"
      className="rounded-[2px] border border-soft-hairline bg-cream-inset/45 px-4 py-4 text-sm leading-relaxed text-faded-sumi"
    >
      <p>
        No starter decks for this level yet. You can{' '}
        <span className="text-sumi-ink">skip this step</span> and browse the full catalogue from your library when you&rsquo;re ready.
      </p>
    </div>
  )
}
