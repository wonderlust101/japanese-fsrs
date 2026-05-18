'use client'

import { useState } from 'react'
import { State, type ApiCard } from '@fsrs-japanese/shared-types'

import { FixtureOption, FixtureOptionList, FixturePanel } from '@/components/dev/FixturePanel'

export type CardDevFixtureKey =
  | 'off'
  | 'full'
  | 'failing'
  | 'suspended'
  | 'premade'
  | 'sparse'
  | 'loading'

export interface CardDevState {
  fixture: CardDevFixtureKey
  /** When fixture !== 'off', this is the synthetic card to render. */
  card:    ApiCard | null
  /** True when the panel is forcing a loading shell. */
  loading: boolean
}

/**
 * Dev-only state switcher for the Card Detail page. Renders nothing in
 * production. In development, floats in the bottom-left and lets you flip
 * the page between fixture states (full / failing / suspended / premade /
 * sparse / loading) without having to seed real data.
 *
 * The hook returns a `state` object the page reads from to either render
 * the real card or the fixture, plus a `panel` element to drop into the
 * page tree.
 */
export function useCardDevState(deckId: string): {
  state: CardDevState
  panel: React.ReactNode
} {
  const [fixture, setFixture] = useState<CardDevFixtureKey>('off')

  const isDev = process.env.NODE_ENV === 'development'
  const card  = fixture === 'off' || fixture === 'loading' ? null : buildFixtureCard(fixture, deckId)

  return {
    state: {
      fixture,
      card,
      loading: fixture === 'loading',
    },
    panel: isDev ? <DevStatePanel fixture={fixture} onChange={setFixture} /> : null,
  }
}

// ─── UI ──────────────────────────────────────────────────────────────────

const FIXTURES: { key: CardDevFixtureKey; label: string; description: string }[] = [
  { key: 'off',       label: 'Live data',  description: 'Real card from the API.' },
  { key: 'full',      label: 'Full card',  description: 'All fields populated: sentences, mnemonic, kanji, image, audio, tags.' },
  { key: 'failing',   label: 'Failing',    description: 'High lapses (12). Repair note appears under the meta strip.' },
  { key: 'suspended', label: 'Suspended',  description: 'Suspended badge in hero; Suspend action becomes Unsuspend.' },
  { key: 'premade',   label: 'Premade',    description: 'Source card with userId = null. Edit / Move / Delete disabled.' },
  { key: 'sparse',    label: 'Sparse',     description: 'No sentences, mnemonic, image, or audio. Tests empty-state suggestions.' },
  { key: 'loading',   label: 'Loading',    description: 'Skeleton state.' },
]

function DevStatePanel({
  fixture,
  onChange,
}: {
  fixture:  CardDevFixtureKey
  onChange: (next: CardDevFixtureKey) => void
}): React.JSX.Element {
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Live data' }

  return (
    <FixturePanel
      title="Dev · Card state"
      summary={active.label}
      ariaLabel="Card detail dev state panel"
      widthClass="max-w-[20rem]"
    >
      <FixtureOptionList ariaLabel="Card fixtures">
        {FIXTURES.map((f) => (
          <FixtureOption
            key={f.key}
            name="card-fixture"
            value={f.key}
            checked={f.key === fixture}
            onChange={() => onChange(f.key)}
            label={f.label}
            description={f.description}
          />
        ))}
      </FixtureOptionList>
    </FixturePanel>
  )
}

// ─── Fixtures ────────────────────────────────────────────────────────────

/**
 * Build a synthetic ApiCard that satisfies the shape the detail page
 * consumes. All fixtures share a common vocab body (大学) and differ only
 * in the dimensions relevant to the state under test.
 */
function buildFixtureCard(key: Exclude<CardDevFixtureKey, 'off' | 'loading'>, deckId: string): ApiCard {
  const base = baseFixtureCard(deckId)

  switch (key) {
    case 'full':
      return base

    case 'failing':
      return { ...base, lapses: 12, state: State.Relearning }

    case 'suspended':
      return { ...base, isSuspended: true }

    case 'premade':
      return { ...base, userId: null } as ApiCard

    case 'sparse':
      return {
        ...base,
        fieldsData: {
          word:    '大学',
          reading: 'だいがく',
          meaning: 'university',
          partOfSpeech: 'noun',
        } as ApiCard['fieldsData'],
        tags: [],
      }
  }
}

function baseFixtureCard(deckId: string): ApiCard {
  // Cast via `unknown` because the fixture only needs to satisfy the subset
  // of fields the detail page actually reads. Keeping the cast localized
  // avoids dragging every nullable field (premadeDeckId, learningSteps, etc.)
  // into the fixture and noisy-updating it every time the canonical schema
  // grows a new column.
  return ({
    id:             'dev-fixture-card',
    deckId,
    userId:         'dev-fixture-user',
    layoutType:     'vocabulary',
    cardType:       'comprehension',
    jlptLevel:      'N3',
    tags:           ['daily', 'reading'],
    state:          State.Review,
    isSuspended:    false,
    due:            new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    stability:      14.2,
    difficulty:     5.6,
    reps:           18,
    lapses:         2,
    elapsedDays:    1,
    scheduledDays:  4,
    lastReview:     new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    version:        7,
    parentCardId:   null,
    embeddingHash:  null,
    createdAt:      new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt:      new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    fieldsData: {
      word:           '大学',
      reading:        'だいがく',
      meaning:        'university; college',
      partOfSpeech:   'noun',
      frequencyRank:  812,
      pitchPosition:  0,
      pitchAccent:    'heiban',
      nuance:         '大学 (daigaku) is the standard term for a four-year university or college. It contrasts with 大学院 (daigakuin, "graduate school") and 短大 (tandai, "junior college"). In casual speech the abbreviation 大 stands in for the full word in compounds like 東大 (Tokyo University) or 京大 (Kyoto University). The word does not imply prestige on its own; reputation is conveyed by the institution name in front of it.',
      collocations: [
        '大学に行く',
        '大学を卒業する',
        '大学院',
        '東京大学',
        '大学生',
      ],
      homophones: [
        '退学',
        '大鶴',
      ],
      exampleSentences: [
        {
          ja:       '私は大学に行きます。',
          furigana: 'わたしはだいがくにいきます。',
          en:       'I go to the university.',
        },
        {
          ja:       '彼は東京大学を卒業しました。',
          furigana: 'かれはとうきょうだいがくをそつぎょうしました。',
          en:       'He graduated from Tokyo University.',
        },
        {
          ja:       'この大学は古い歴史を持っています。',
          furigana: 'このだいがくはふるいれきしをもっています。',
          en:       'This university has a long history.',
        },
      ],
      kanjiBreakdown: [
        {
          kanji:   '大',
          radical: '大 (big)',
          meaning: 'big, large, great',
          reading: 'ダイ・タイ / おお（きい）',
        },
        {
          kanji:   '学',
          radical: '子 (child)',
          meaning: 'study, learning',
          reading: 'ガク / まな（ぶ）',
        },
      ],
      mnemonic: 'A “big study” place. When a child (子, inside 学) grows BIG enough to take their STUDY seriously, they head to 大学.',
      // Forward-compat keys; the page reads these out of raw fieldsData.
      image:           'https://placehold.co/600x320?text=%E5%A4%A7%E5%AD%A6',
      expressionAudio: 'https://example.invalid/audio/daigaku.mp3',
    } as unknown as ApiCard['fieldsData'],
  } as unknown) as ApiCard
}
