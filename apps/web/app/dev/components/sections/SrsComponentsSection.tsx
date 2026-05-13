'use client'

import { useState } from 'react'
import { DailyQuotaChart }            from '@/components/srs/DailyQuotaChart'
import { DeckSummary }                from '@/components/srs/DeckSummary'
import { ForgettingCurve }            from '@/components/srs/ForgettingCurve'
import { SampleCard }                 from '@/components/srs/SampleCard'
import { SampleSentence }             from '@/components/srs/SampleSentence'
import { ScheduleHorizon }            from '@/components/srs/ScheduleHorizon'
import { VolumeBar }                  from '@/components/srs/VolumeBar'
import { ActiveDecks, type ActiveDeck } from '@/app/(app)/dashboard/_components/active-decks'
import { DashboardHero, type DashboardHeroVariant, type DueQueue, type HeroKind } from '@/app/(app)/dashboard/_components/dashboard-hero'
import { ForecastChart } from '@/app/(app)/dashboard/_components/forecast-chart'
import { Leeches, type Leech } from '@/app/(app)/dashboard/_components/leeches'
import { PracticeSignal, type PracticeInsight } from '@/app/(app)/dashboard/_components/practice-signal'
import { RecentActivity, type ActivityRow } from '@/app/(app)/dashboard/_components/recent-activity'
import type { ModuleState } from '@/app/(app)/dashboard/_components/section-primitives'
import { ShowcaseGrid, ShowcaseItem } from '../_components/ShowcaseItem'
import { ShowcaseSection }            from '../_components/ShowcaseSection'

const MOCK_DECKS = [
  { id: 'core2k',   name: 'Core 2k',        count: 2000 },
  { id: 'kanji-n5', name: 'Kanji · N5',     count: 103  },
  { id: 'travel',   name: 'Travel phrases', count: 240  },
] as const

type SentenceChunk = string | { base: string; reading: string }

const SENTENCE_CHUNKS: ReadonlyArray<SentenceChunk> = [
  { base: '今日',     reading: 'きょう' },
  'は',
  { base: '日本語',   reading: 'にほんご' },
  'を',
  { base: '勉強',     reading: 'べんきょう' },
  'します。',
]

const HERO_STATE_OPTIONS: Array<{ value: HeroKind; label: string }> = [
  { value: 'due',        label: 'Due' },
  { value: 'caught-up',  label: 'Caught up' },
  { value: 'first-time', label: 'First time' },
  { value: 'loading',    label: 'Loading' },
  { value: 'error',      label: 'Error' },
]

type HeroDeckPreviewMode = 'stack' | 'single'

const HERO_DECK_OPTIONS: Array<{ value: HeroDeckPreviewMode; label: string }> = [
  { value: 'stack',  label: '3 decks' },
  { value: 'single', label: '1 deck'  },
]

type DashboardModulePreviewState = 'default' | 'loading' | 'empty' | 'error'

const MODULE_STATE_OPTIONS: Array<{ value: DashboardModulePreviewState; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty',   label: 'Empty' },
  { value: 'error',   label: 'Error' },
]

const HERO_QUEUE: DueQueue = {
  total:         12,
  newCnt:        3,
  review:        7,
  backlog:       2,
  decks: [
    {
      id:          'showcase-n4-verbs',
      title:       'N4 verbs',
      subtitle:    'Conjugation and recall',
      dueCount:    5,
      newCount:    2,
      reviewCount: 3,
      tag:          { kind: 'level', level: 'N4' },
    },
    {
      id:          'showcase-kanji',
      title:       'Joyo kanji',
      subtitle:    'Recognition practice',
      dueCount:    4,
      newCount:    1,
      reviewCount: 3,
      tag:          { kind: 'level', level: 'N3' },
    },
    {
      id:          'showcase-grammar',
      title:       'Grammar patterns',
      subtitle:    'Short examples',
      dueCount:    3,
      newCount:    0,
      reviewCount: 3,
      tag:          { kind: 'level', level: 'beyond_jlpt' },
    },
  ],
  overflowDecks: 0,
}

const HERO_SINGLE_DECK_QUEUE: DueQueue = {
  total:         12,
  newCnt:        3,
  review:        7,
  backlog:       2,
  decks: [
    {
      id:          'showcase-single-n4-verbs',
      title:       'N4 verbs',
      subtitle:    'Conjugation and recall',
      dueCount:    12,
      newCount:    3,
      reviewCount: 9,
      tag:          { kind: 'level', level: 'N4' },
    },
  ],
  overflowDecks: 0,
}

const DASHBOARD_FORECAST_DAYS = [
  { label: 'Mon', dateNum: 11, count: 12, isToday: true,  backlogCount: 2, reviewCount: 7,  newCount: 3 },
  { label: 'Tue', dateNum: 12, count: 8,  isToday: false, backlogCount: 0, reviewCount: 5,  newCount: 3 },
  { label: 'Wed', dateNum: 13, count: 18, isToday: false, backlogCount: 0, reviewCount: 15, newCount: 3 },
  { label: 'Thu', dateNum: 14, count: 5,  isToday: false, backlogCount: 0, reviewCount: 2,  newCount: 3 },
  { label: 'Fri', dateNum: 15, count: 22, isToday: false, backlogCount: 0, reviewCount: 19, newCount: 3 },
  { label: 'Sat', dateNum: 16, count: 14, isToday: false, backlogCount: 0, reviewCount: 11, newCount: 3 },
  { label: 'Sun', dateNum: 17, count: 3,  isToday: false, backlogCount: 0, reviewCount: 0,  newCount: 3 },
  { label: 'Mon', dateNum: 18, count: 9,  isToday: false, backlogCount: 0, reviewCount: 6,  newCount: 3 },
  { label: 'Tue', dateNum: 19, count: 6,  isToday: false, backlogCount: 0, reviewCount: 3,  newCount: 3 },
  { label: 'Wed', dateNum: 20, count: 13, isToday: false, backlogCount: 0, reviewCount: 10, newCount: 3 },
  { label: 'Thu', dateNum: 21, count: 4,  isToday: false, backlogCount: 0, reviewCount: 1,  newCount: 3 },
  { label: 'Fri', dateNum: 22, count: 17, isToday: false, backlogCount: 0, reviewCount: 14, newCount: 3 },
  { label: 'Sat', dateNum: 23, count: 7,  isToday: false, backlogCount: 0, reviewCount: 4,  newCount: 3 },
  { label: 'Sun', dateNum: 24, count: 10, isToday: false, backlogCount: 0, reviewCount: 7,  newCount: 3 },
]

const DASHBOARD_ACTIVE_DECKS: ActiveDeck[] = [
  {
    id:              'showcase-n4-verbs',
    title:           'N4 verbs',
    level:           'N4',
    dueCount:        5,
    totalCards:      320,
    newCount:        2,
    reviewCount:     3,
    masteryPercent:  42,
    lastReviewedRel: 'yesterday',
  },
  {
    id:              'showcase-kanji',
    title:           'Joyo kanji',
    level:           'N3',
    dueCount:        4,
    totalCards:      640,
    newCount:        1,
    reviewCount:     3,
    masteryPercent:  58,
    lastReviewedRel: '2 days ago',
  },
  {
    id:              'showcase-grammar',
    title:           'Grammar patterns',
    level:           'beyond_jlpt',
    dueCount:        3,
    totalCards:      180,
    newCount:        0,
    reviewCount:     3,
    masteryPercent:  27,
    lastReviewedRel: 'Friday',
  },
]

const DASHBOARD_LEECHES: Leech[] = [
  { cardId: 'showcase-leech-1', word: '払う', reading: 'はらう', errors: 9 },
  { cardId: 'showcase-leech-2', word: '必要', reading: 'ひつよう', errors: 8 },
  { cardId: 'showcase-leech-3', word: '続ける', reading: 'つづける', errors: 7 },
]

const DASHBOARD_RECENT: ActivityRow[] = [
  { date: 'Today',     reviewed: null, retention: null },
  { date: 'Sunday',    reviewed: 18,   retention: 0.89 },
  { date: 'Saturday',  reviewed: 0,    retention: null },
  { date: 'Friday',    reviewed: 24,   retention: 0.83 },
  { date: 'Thursday',  reviewed: 31,   retention: 0.91 },
]

const DASHBOARD_SIGNAL: PracticeInsight = {
  date: 'May 11',
  body: (
    <>
      You&apos;re steady on recognition cards. Give a little extra care to{' '}
      <span lang="ja">払う</span> today.
    </>
  ),
}

function heroVariantFor(kind: HeroKind, deckMode: HeroDeckPreviewMode): DashboardHeroVariant {
  if (kind === 'due') {
    return { kind: 'due', queue: deckMode === 'single' ? HERO_SINGLE_DECK_QUEUE : HERO_QUEUE }
  }
  return { kind }
}

function moduleStateFor(state: DashboardModulePreviewState): ModuleState {
  if (state === 'loading') return 'loading'
  if (state === 'error') return 'error'
  return 'default'
}

export function SrsComponentsSection(): React.JSX.Element {
  const [pace,         setPace]         = useState<'light' | 'steady' | 'intensive' | null>('steady')
  const [subscribedIds, setSubscribedIds] = useState<ReadonlySet<string>>(new Set(['core2k', 'kanji-n5']))
  const [volume,       setVolume]       = useState<'beginner' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | null>('N4')
  const [heroKind,     setHeroKind]     = useState<HeroKind>('due')
  const [heroDeckMode, setHeroDeckMode] = useState<HeroDeckPreviewMode>('stack')
  const [moduleState,  setModuleState]  = useState<DashboardModulePreviewState>('default')

  const dashboardModuleState = moduleStateFor(moduleState)
  const modulesEmpty = moduleState === 'empty'

  const toggleDeck = (id: string): void => {
    setSubscribedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <ShowcaseSection
      id="srs"
      title="SRS components"
      description="Composed visualizations and previews from the onboarding and dashboard flows."
    >
      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">DashboardHero</h3>
        <div className="rounded-[2px] border border-soft-hairline bg-cool-paper-base p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {HERO_STATE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHeroKind(option.value)}
                className={[
                  'h-8 rounded-[2px] border px-3 text-xs font-medium transition-colors duration-150 ease-out',
                  heroKind === option.value
                    ? 'border-inari-vermillion bg-vermillion-wash text-inari-vermillion-deep'
                    : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {HERO_DECK_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHeroDeckMode(option.value)}
                className={[
                  'h-8 rounded-[2px] border px-3 text-xs font-medium transition-colors duration-150 ease-out',
                  heroDeckMode === option.value
                    ? 'border-inari-vermillion bg-vermillion-wash text-inari-vermillion-deep'
                    : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
          <DashboardHero variant={heroVariantFor(heroKind, heroDeckMode)} />
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Dashboard module archetypes</h3>
        <div className="rounded-[2px] border border-soft-hairline bg-cool-paper-base p-3 sm:p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {MODULE_STATE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setModuleState(option.value)}
                className={[
                  'h-8 rounded-[2px] border px-3 text-xs font-medium transition-colors duration-150 ease-out',
                  moduleState === option.value
                    ? 'border-inari-vermillion bg-vermillion-wash text-inari-vermillion-deep'
                    : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-12">
              <div className="md:col-span-8">
                <ForecastChart
                  state={dashboardModuleState}
                  days={modulesEmpty ? [] : DASHBOARD_FORECAST_DAYS}
                />
              </div>
              <div className="md:col-span-4">
                <PracticeSignal
                  state={dashboardModuleState}
                  insight={modulesEmpty ? null : DASHBOARD_SIGNAL}
                />
              </div>
            </div>

            <ActiveDecks
              state={dashboardModuleState}
              decks={modulesEmpty ? [] : DASHBOARD_ACTIVE_DECKS}
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <Leeches
                state={dashboardModuleState}
                leeches={modulesEmpty ? [] : DASHBOARD_LEECHES}
              />
              <RecentActivity
                state={dashboardModuleState}
                rows={modulesEmpty ? [] : DASHBOARD_RECENT}
              />
            </div>

          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">SampleCard / SampleSentence</h3>
        <ShowcaseGrid minColumnWidth={320}>
          <ShowcaseItem label="SampleCard" caption='word/reading/meaning/caption' fill>
            <SampleCard
              word="勉強"
              reading="べんきょう"
              meaning="study, learning"
              caption="next review · in 4h"
            />
          </ShowcaseItem>
          <ShowcaseItem label="SampleSentence" caption="chunks=[{base,reading},...] translation" fill>
            <SampleSentence
              chunks={SENTENCE_CHUNKS}
              translation="Today I'll study Japanese."
              caption="from · interest: Travel"
            />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">DailyQuotaChart</h3>
        <ShowcaseGrid minColumnWidth={420}>
          <ShowcaseItem label="DailyQuotaChart" caption={`pace="${pace ?? 'null'}"`} fill>
            <div className="flex flex-col gap-3">
              <DailyQuotaChart pace={pace} />
              <div className="flex gap-2 text-xs">
                {(['light', 'steady', 'intensive', null] as const).map(p => (
                  <button
                    key={String(p)}
                    type="button"
                    onClick={() => setPace(p)}
                    className={[
                      'px-2 py-1 rounded-[2px] border',
                      pace === p
                        ? 'border-inari-vermillion text-inari-vermillion'
                        : 'border-soft-hairline text-faded-sumi hover:border-faded-sumi',
                    ].join(' ')}
                  >
                    {p ?? '(none)'}
                  </button>
                ))}
              </div>
            </div>
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">DeckSummary</h3>
        <ShowcaseGrid minColumnWidth={420}>
          <ShowcaseItem label="DeckSummary" caption="allDecks / subscribedIds / paceNewPerDay" fill>
            <div className="flex flex-col gap-3">
              <DeckSummary allDecks={MOCK_DECKS} subscribedIds={subscribedIds} paceNewPerDay={20} />
              <div className="flex flex-wrap gap-2 text-xs">
                {MOCK_DECKS.map(deck => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => toggleDeck(deck.id)}
                    className={[
                      'px-2 py-1 rounded-[2px] border',
                      subscribedIds.has(deck.id)
                        ? 'border-inari-vermillion text-inari-vermillion'
                        : 'border-soft-hairline text-faded-sumi hover:border-faded-sumi',
                    ].join(' ')}
                  >
                    {deck.name}
                  </button>
                ))}
              </div>
            </div>
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">ForgettingCurve / ScheduleHorizon</h3>
        <ShowcaseGrid minColumnWidth={420}>
          <ShowcaseItem label="ForgettingCurve" caption="(no required props)" fill>
            <ForgettingCurve />
          </ShowcaseItem>
          <ShowcaseItem label="ScheduleHorizon" caption="totalCards={2103} paceNewPerDay={20}" fill>
            <ScheduleHorizon totalCards={2103} paceNewPerDay={20} />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">VolumeBar</h3>
        <ShowcaseGrid minColumnWidth={320}>
          <ShowcaseItem label="VolumeBar" caption={`selected="${volume ?? 'null'}"`} fill>
            <div className="flex flex-col gap-3">
              <VolumeBar selected={volume} />
              <div className="flex flex-wrap gap-2 text-xs">
                {(['beginner', 'N5', 'N4', 'N3', 'N2', 'N1', null] as const).map(level => (
                  <button
                    key={String(level)}
                    type="button"
                    onClick={() => setVolume(level)}
                    className={[
                      'px-2 py-1 rounded-[2px] border',
                      volume === level
                        ? 'border-inari-vermillion text-inari-vermillion'
                        : 'border-soft-hairline text-faded-sumi hover:border-faded-sumi',
                    ].join(' ')}
                  >
                    {level ?? '(none)'}
                  </button>
                ))}
              </div>
            </div>
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>
    </ShowcaseSection>
  )
}
