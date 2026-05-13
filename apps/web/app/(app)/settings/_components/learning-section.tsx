'use client'

import { useState } from 'react'

import { Pill, PillGroup } from '@/components/ui/Pill'
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
    void commit('JLPT target', { jlptTarget: value }, () => setJlpt(prev))
  }

  function changeDailyNew(value: number): void {
    setDailyNew(value)
  }
  function commitDailyNew(): void {
    if (dailyNew === initialDailyNew) return
    void commit('Daily new cards', { dailyNewCardsLimit: dailyNew }, () => setDailyNew(initialDailyNew))
  }

  function changeDailyReview(value: number): void {
    setDailyReview(value)
  }
  function commitDailyReview(): void {
    if (dailyReview === initialDailyReview) return
    void commit('Daily reviews', { dailyReviewLimit: dailyReview }, () => setDailyReview(initialDailyReview))
  }

  function changeRetention(value: number): void {
    setRetention(value)
  }
  function commitRetention(): void {
    if (retention === initialRetention) return
    void commit('Retention target', { retentionTarget: retention }, () => setRetention(initialRetention))
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
      <h2 className="text-lg font-semibold text-sumi-ink">Learning preferences</h2>

      <Field label="JLPT target">
        <PillGroup compact>
          {JLPT_LEVELS.map((lvl) => (
            <Pill
              key={lvl}
              variant="interactive"
              size="lg"
              mark="#"
              selected={jlpt === lvl}
              onClick={() => changeJlpt(lvl)}
              ariaLabel={`Set JLPT target to ${lvl === 'beyond_jlpt' ? 'Beyond JLPT' : lvl}`}
            >
              {lvl === 'beyond_jlpt' ? 'Beyond JLPT' : lvl}
            </Pill>
          ))}
        </PillGroup>
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
        hint={`${Math.round(retention * 100)}% remembered. Higher means more reviews, fewer lapses.`}
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
        <PillGroup compact>
          {INTEREST_OPTIONS.map((name) => {
            const active = interests.includes(name)
            return (
              <Pill
                key={name}
                variant="interactive"
                size="lg"
                mark="•"
                selected={active}
                onClick={() => toggleInterest(name)}
                ariaLabel={`${active ? 'Remove' : 'Add'} interest ${name}`}
              >
                {name}
              </Pill>
            )
          })}
        </PillGroup>
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
        <span className="block text-sm font-medium text-sumi-ink">{label}</span>
        {hint !== undefined && <span className="text-xs text-faded-sumi tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
