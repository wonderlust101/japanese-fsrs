'use client'

import { useEffect, useRef } from 'react'
import { useRouter }         from 'next/navigation'

import Link               from 'next/link'
import { Button }            from '@/components/ui/Button'
import { FuriganaText }      from '@/components/ui/FuriganaText'
import { RatingBreakdown }   from '@/components/review/RatingBreakdown'
import { useSearchParams }    from 'next/navigation'
import { useSessionSummary } from '@/lib/api/reviews'
import { useSessionActions } from '@/stores/useReviewSessionStore'
import { sessionSummaryParamsSchema } from '@fsrs-japanese/shared-types'
import { z } from 'zod'

const PERSONAL_BEST_KEY = 'fsrs:longestSession'

// Coerces the localStorage value to a non-negative integer, falling back to 0
// for missing / NaN / tampered values.
const personalBestSchema = z.coerce.number().int().nonnegative().catch(0)

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-3xl font-bold text-neutral-900">{value}</span>
      <span className="text-xs text-neutral-500 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function formatNextDue(isoDate: string): string {
  const due    = new Date(isoDate)
  const now    = new Date()
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)

  const time = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (diffDays === 0) return `Today at ${time}`
  if (diffDays === 1) return `Tomorrow at ${time}`
  const date = due.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return `${date} at ${time}`
}

function MetricSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-9 w-16 rounded bg-neutral-100 animate-pulse" />
      <div className="h-3 w-12 rounded bg-neutral-100 animate-pulse" />
    </div>
  )
}

export default function ReviewSummaryPage(): React.JSX.Element {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const parsedParams = sessionSummaryParamsSchema.safeParse({ sessionId: searchParams.get('id') })
  const sessionId    = parsedParams.success ? parsedParams.data.sessionId : null
  const { reset }    = useSessionActions()

  const { data: summary, isLoading, isError } = useSessionSummary(sessionId)

  const bestAppliedRef = useRef(false)
  const isNewRecord    = useRef(false)

  // Guard: no active session → back to review hub
  useEffect(() => {
    if (sessionId === null) {
      router.replace('/review')
    }
  }, [sessionId, router])

  // Personal-best comparison runs once when data arrives (localStorage placeholder)
  useEffect(() => {
    if (summary === undefined || bestAppliedRef.current) return
    bestAppliedRef.current = true

    const previousBest = personalBestSchema.parse(localStorage.getItem(PERSONAL_BEST_KEY) ?? '0')
    if (summary.totalCards > previousBest) {
      isNewRecord.current = true
      localStorage.setItem(PERSONAL_BEST_KEY, String(summary.totalCards))
    }
  }, [summary])

  function handleDashboard() {
    reset()
    router.push('/dashboard')
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  })

  const previousBest =
    typeof window !== 'undefined'
      ? personalBestSchema.parse(localStorage.getItem(PERSONAL_BEST_KEY) ?? '0')
      : 0

  return (
    <div className="flex flex-col items-center px-4 py-12 gap-6 max-w-xl mx-auto">

      {/* Header */}
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-8 flex flex-col items-center gap-2 text-center">
        <div className="text-4xl mb-1">✓</div>
        <h1 className="text-2xl font-bold text-neutral-900">Session Complete</h1>
        <p className="text-sm text-neutral-500">{today}</p>
      </div>

      {/* Metrics grid */}
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-6">
        <div className="grid grid-cols-3 divide-x divide-neutral-100">
          {isLoading ? (
            <>
              <div className="px-4"><MetricSkeleton /></div>
              <div className="px-4"><MetricSkeleton /></div>
              <div className="px-4"><MetricSkeleton /></div>
            </>
          ) : isError || summary === undefined ? (
            <div className="col-span-3 text-center text-sm text-neutral-500 py-4">
              Could not load session stats.
            </div>
          ) : (
            <>
              <div className="px-4 flex items-center justify-center">
                <MetricCell label="Cards" value={String(summary.totalCards)} />
              </div>
              <div className="px-4 flex items-center justify-center">
                <MetricCell label="Time" value={formatTime(summary.totalTimeMs)} />
              </div>
              <div className="px-4 flex items-center justify-center">
                <MetricCell label="Accuracy" value={`${summary.accuracyPct}%`} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rating Breakdown */}
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-6 flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Rating Breakdown
        </h2>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-10 rounded bg-neutral-100 animate-pulse shrink-0" />
                <div className="flex-1 h-2.5 rounded-full bg-neutral-100 animate-pulse" />
                <div className="h-3 w-5 rounded bg-neutral-100 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        ) : summary !== undefined ? (
          <RatingBreakdown breakdown={summary.ratingBreakdown} total={summary.totalCards} />
        ) : null}
      </div>

      {/* Cards to Watch */}
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-6 flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Cards to Watch
        </h2>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : summary !== undefined && summary.leeches.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No leeches today! Your retention is looking strong.
          </p>
        ) : summary !== undefined ? (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {summary.leeches.map((leech) => (
              <li key={leech.leechId}>
                <Link
                  href={`/decks/${leech.deckId}/cards/${leech.cardId}`}
                  className="flex items-center justify-between py-3 group"
                >
                  {leech.reading !== null ? (
                    <FuriganaText
                      text={leech.word}
                      reading={leech.reading}
                      className="font-japanese text-base font-medium text-neutral-900 group-hover:text-primary-600 transition-colors"
                    />
                  ) : (
                    <span lang="ja" className="font-japanese text-base font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">
                      {leech.word}
                    </span>
                  )}
                  <span className="text-neutral-400 text-sm">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Personal Bests */}
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-6 flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Personal Bests
        </h2>

        {isLoading ? (
          <div className="h-5 w-48 rounded bg-neutral-100 animate-pulse" />
        ) : summary !== undefined && summary.totalCards > 0 ? (
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            {isNewRecord.current ? (
              <>
                <span className="text-yellow-500 text-base">★</span>
                <span className="font-semibold">New record!</span>
                <span>{summary.totalCards} cards in one session</span>
              </>
            ) : (
              <>
                <span className="text-neutral-400 text-base">★</span>
                <span>Best: <span className="font-semibold">{previousBest} cards</span> in one session</span>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Next Review */}
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-6 flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Next Review
        </h2>
        {isLoading ? (
          <div className="h-5 w-48 rounded bg-neutral-100 animate-pulse" />
        ) : summary?.nextDueAt != null ? (
          <p className="text-sm text-neutral-700">
            <span className="font-semibold">{formatNextDue(summary.nextDueAt)}</span>
          </p>
        ) : (
          <p className="text-sm text-neutral-500">No upcoming reviews scheduled.</p>
        )}
      </div>

      {/* Navigation */}
      <Button onClick={handleDashboard} className="w-full max-w-xs">
        Back to Dashboard
      </Button>
    </div>
  )
}
