'use client'

import { useState } from 'react'

import { updateProfileAction } from '@/lib/actions/profile.actions'
import { isJlptLevel }         from '@fsrs-japanese/shared-types'

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt'] as const
type JlptLevel = (typeof JLPT_LEVELS)[number]

const INTEREST_OPTIONS = [
  'Anime & Manga', 'Travel', 'Business', 'News', 'Music',
  'Food', 'Gaming', 'Literature', 'Sports', 'Science',
  'Pop culture', 'Slang & casual',
]

interface Props {
  initialJlptTarget:  string | null
  initialDailyNew:    number
  initialDailyReview: number
  initialRetention:   number
  initialInterests:   string[]
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export function LearningSection({
  initialJlptTarget,
  initialDailyNew,
  initialDailyReview,
  initialRetention,
  initialInterests,
  onSaved,
  onError,
}: Props): React.JSX.Element {
  const [jlpt,        setJlpt]        = useState<JlptLevel>(
    isJlptLevel(initialJlptTarget) ? initialJlptTarget : 'N5',
  )
  const [dailyNew,    setDailyNew]    = useState(initialDailyNew)
  const [dailyReview, setDailyReview] = useState(initialDailyReview)
  const [retention,   setRetention]   = useState(initialRetention)
  const [interests,   setInterests]   = useState<string[]>(initialInterests)

  async function commit(
    name: string,
    payload: Parameters<typeof updateProfileAction>[0],
    rollback: () => void,
  ): Promise<void> {
    try {
      await updateProfileAction(payload)
      onSaved(`${name} saved`)
    } catch (e) {
      rollback()
      onError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  function changeJlpt(value: JlptLevel): void {
    const prev = jlpt
    setJlpt(value)
    void commit('JLPT target', { jlpt_target: value }, () => setJlpt(prev))
  }

  function changeDailyNew(value: number): void {
    setDailyNew(value)
  }
  function commitDailyNew(): void {
    if (dailyNew === initialDailyNew) return
    void commit('Daily new cards', { daily_new_cards_limit: dailyNew }, () => setDailyNew(initialDailyNew))
  }

  function changeDailyReview(value: number): void {
    setDailyReview(value)
  }
  function commitDailyReview(): void {
    if (dailyReview === initialDailyReview) return
    void commit('Daily reviews', { daily_review_limit: dailyReview }, () => setDailyReview(initialDailyReview))
  }

  function changeRetention(value: number): void {
    setRetention(value)
  }
  function commitRetention(): void {
    if (retention === initialRetention) return
    void commit('Retention target', { retention_target: retention }, () => setRetention(initialRetention))
  }

  function toggleInterest(name: string): void {
    const next = interests.includes(name)
      ? interests.filter((i) => i !== name)
      : [...interests, name]
    setInterests(next)
    void commit('Interests', { interests: next }, () => setInterests(interests))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Learning preferences</h2>

      <Field label="JLPT target">
        <div className="flex flex-wrap gap-2">
          {JLPT_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => changeJlpt(lvl)}
              aria-pressed={jlpt === lvl}
              className={[
                'h-9 px-3 rounded-full text-sm font-medium transition-colors',
                jlpt === lvl
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
              ].join(' ')}
            >
              {lvl === 'beyond_jlpt' ? 'Beyond JLPT' : lvl}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Daily new cards"
        hint={`${dailyNew} cards per day`}
      >
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={dailyNew}
          onChange={(e) => changeDailyNew(Number(e.target.value))}
          onMouseUp={commitDailyNew}
          onTouchEnd={commitDailyNew}
          onKeyUp={commitDailyNew}
          className="w-full"
        />
      </Field>

      <Field
        label="Daily review limit"
        hint={`${dailyReview} reviews per day`}
      >
        <input
          type="range"
          min={20}
          max={1000}
          step={10}
          value={dailyReview}
          onChange={(e) => changeDailyReview(Number(e.target.value))}
          onMouseUp={commitDailyReview}
          onTouchEnd={commitDailyReview}
          onKeyUp={commitDailyReview}
          className="w-full"
        />
      </Field>

      <Field
        label="Retention target"
        hint={`${Math.round(retention * 100)}% — higher means more reviews, fewer lapses.`}
      >
        <input
          type="range"
          min={0.6}
          max={0.99}
          step={0.01}
          value={retention}
          onChange={(e) => changeRetention(Number(e.target.value))}
          onMouseUp={commitRetention}
          onTouchEnd={commitRetention}
          onKeyUp={commitRetention}
          className="w-full"
        />
      </Field>

      <Field label="Interests" hint="Used to personalise AI-generated examples.">
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((name) => {
            const active = interests.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleInterest(name)}
                aria-pressed={active}
                className={[
                  'h-8 px-3 rounded-full text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                ].join(' ')}
              >
                {name}
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label:    string
  hint?:    string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="block text-sm font-medium text-neutral-700">{label}</span>
        {hint !== undefined && <span className="text-xs text-neutral-500 tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
