import type { ApiDueCard } from '@fsrs-japanese/shared-types'

// Synthetic cards used only by the session dev tools dock. They satisfy the
// ApiDueCard shape (vocabulary or sentence layout) and additionally carry
// dev-only fields the production schema doesn't yet expose:
//   - picture (URL)
//   - expressionAudio / sentenceAudio (URL)
//   - pitchPosition (number)
// These are stuffed onto `fieldsData` and only read by the new review
// surface's `card-fields.ts` helper, never by API consumers. Production
// review will see these as undefined and degrade gracefully.

export type FixtureKind = 'comprehension'

interface Fixture {
  kind:  FixtureKind
  label: string
  /** Short note explaining what styling situation the fixture exercises. */
  note?: string
  card:  ApiDueCard
}

function id(slug: string): string {
  return `fixture-${slug}`
}

// ── Comprehension fixtures ──────────────────────────────────────────────────

const COMP_FIXTURES: Fixture[] = [
  {
    kind:  'comprehension',
    label: '食べる · full back',
    note:  'Everything present: picture, audio, pitch, mnemonic, kanji breakdown, frequency.',
    card: {
      id:         id('comp-taberu'),
      deckId:     'fixture-deck',
      jlptLevel:  'N5',
      state:      2,
      due:        new Date().toISOString(),
      layoutType: 'vocabulary',
      fieldsData: {
        word:           '食べる',
        reading:        'たべる',
        meaning:        'to eat',
        partOfSpeech:   'ru-verb',
        frequencyRank:  482,
        mnemonic:       '田 (rice paddy) + 木 (tree). Picture eating fruit picked from a tree by the rice fields. The 良 (good) middle says: rice + tree = good food.',
        nuance:         '食べる is the everyday ru-verb for human eating, slightly more polite and self-aware than 食う (kuu, casual/masculine). For animal subjects use 食う or domain-specific verbs (魚を食む for fish nibbling). 召し上がる is its respectful equivalent when offering food to a guest or speaking about someone of higher status.',
        pitchPosition:  2,
        pitchAccent:    'たべ\\る',
        picture:         'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
        expressionAudio: 'https://audio.tatoeba.org/sentences/jpn/97.mp3',
        exampleSentences: [{
          ja:       '毎朝パンを食べます。',
          en:       'I eat bread every morning.',
          furigana: '毎朝[まいあさ]パンを食[た]べます。',
          // dev-only audio field, read by `card-fields.ts` via a runtime
          // `unknown` check. ExampleSentenceSchema doesn't declare `audio` yet
          // (kanban follow-up), so we spread through `unknown` to satisfy
          // exactOptionalPropertyTypes without widening the schema's type.
          ...({ audio: 'https://audio.tatoeba.org/sentences/jpn/115.mp3' } as unknown as object),
        }],
        collocations: ['ご飯を食べる', 'パンを食べる', '外で食べる'],
        homophones:   [],
        kanjiBreakdown: [
          { kanji: '食', radical: '⻟ (eat)', meaning: 'eat, food', reading: 'しょく / た（べる）' },
        ],
      },
    },
  },
  {
    kind:  'comprehension',
    label: '紅葉 · no picture, no audio',
    note:  'Degrades to single-column; rating bar still strengthened.',
    card: {
      id:         id('comp-momiji'),
      deckId:     'fixture-deck',
      jlptLevel:  'N3',
      state:      2,
      due:        new Date().toISOString(),
      layoutType: 'vocabulary',
      fieldsData: {
        word:          '紅葉',
        reading:       'もみじ',
        meaning:       'autumn leaves; Japanese maple',
        partOfSpeech:  'noun',
        frequencyRank: 4810,
        pitchPosition: 1,
        mnemonic:      '紅 (crimson) + 葉 (leaf). The crimson leaves of Kyoto in November.',
        nuance:        '紅葉 reads two ways: もみじ (the leaves, especially Japanese maple) and こうよう (the seasonal phenomenon of leaves changing color). 紅葉狩り (momijigari) is the traditional pastime of viewing autumn leaves, paralleling 花見 in spring.',
        exampleSentences: [{
          ja:       '京都の紅葉はとても綺麗です。',
          en:       "Kyoto's autumn leaves are very beautiful.",
          furigana: '京都[きょうと]の紅葉[もみじ]はとても綺麗[きれい]です。',
        }],
        kanjiBreakdown: [
          { kanji: '紅', radical: '糸 (thread)', meaning: 'crimson, deep red', reading: 'こう / べに / くれない' },
          { kanji: '葉', radical: '艹 (grass)', meaning: 'leaf',               reading: 'よう / は' },
        ],
      },
    },
  },
  {
    kind:  'comprehension',
    label: '懐かしい · no example sentence',
    note:  'Sentence band hides entirely; definition fills the space.',
    card: {
      id:         id('comp-natsukashii'),
      deckId:     'fixture-deck',
      jlptLevel:  'N2',
      state:      1,
      due:        new Date().toISOString(),
      layoutType: 'vocabulary',
      fieldsData: {
        word:         '懐かしい',
        reading:      'なつかしい',
        meaning:      'nostalgic; dear; missed',
        partOfSpeech: 'i-adjective',
        mnemonic:     'A warm feeling toward something or someone you have not seen in a long time.',
      },
    },
  },
  {
    kind:  'comprehension',
    label: '橋 vs 箸 · pitch matters (homophones)',
    note:  'Demonstrates the pitch graph + homophones tab.',
    card: {
      id:         id('comp-hashi'),
      deckId:     'fixture-deck',
      jlptLevel:  'N4',
      state:      2,
      due:        new Date().toISOString(),
      layoutType: 'vocabulary',
      fieldsData: {
        word:          '橋',
        reading:       'はし',
        meaning:       'bridge',
        partOfSpeech:  'noun',
        pitchPosition: 2,           // odaka (low-high)
        frequencyRank: 1820,
        exampleSentences: [{
          ja:       'この橋は古いです。',
          en:       'This bridge is old.',
          furigana: 'この橋[はし]は古[ふる]いです。',
        }],
        homophones: ['箸 (chopsticks, atamadaka)', '端 (edge, heiban)'],
      },
    },
  },
  {
    kind:  'comprehension',
    label: '言葉 · long content (scroll test)',
    note:  'Every tab populated with verbose content; exercises the in-card scroll inside the centered SectionCard.',
    card: {
      id:         id('comp-long-kotoba'),
      deckId:     'fixture-deck',
      jlptLevel:  'N4',
      state:      2,
      due:        new Date().toISOString(),
      layoutType: 'vocabulary',
      fieldsData: {
        word:           '言葉',
        reading:        'ことば',
        meaning:        'word; language; speech; expression; phrase; remark; saying',
        partOfSpeech:   'noun',
        frequencyRank:  214,
        pitchPosition:  3,
        picture:         'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
        expressionAudio: 'https://audio.tatoeba.org/sentences/jpn/97.mp3',
        mnemonic:       '言 (say) + 葉 (leaf). A word is a leaf that comes from speaking: small, alive, falling into the listener\'s ear. The image is older than literacy itself; the same kanji compound has carried the meaning since Old Japanese poetry.',
        nuance:         '言葉 covers a broad range of meanings centered on \"language as a vehicle for thought\": individual words, phrases, expressions, and language as a whole. It is more abstract and reflective than 単語 (tango, a vocabulary word as a unit) and more universal than 文 (bun, a written sentence). In careful speech it carries a slight literary or thoughtful weight, the kind of register a teacher uses when discussing how something was *said* rather than what was said. Near-synonyms: 表現 (hyōgen, expression, more formal), 発言 (hatsugen, an utterance in a meeting or interview), 名言 (meigen, a famous quotable saying). Antonyms in context: 沈黙 (chinmoku, silence) and 行動 (kōdō, action) when the speaker draws a contrast between speaking and doing.',
        exampleSentences: [{
          ja:       'その言葉は彼の心に深く残った。',
          en:       'Those words remained deeply in his heart.',
          furigana: 'その言葉[ことば]は彼[かれ]の心[こころ]に深[ふか]く残[のこ]った。',
          ...({ audio: 'https://audio.tatoeba.org/sentences/jpn/115.mp3' } as unknown as object),
        }],
        collocations: ['言葉を交わす', '言葉を選ぶ', '言葉に詰まる', '優しい言葉', '心に響く言葉', '言葉では言い表せない'],
        homophones:   [],
        kanjiBreakdown: [
          { kanji: '言', radical: '言 (speech)', meaning: 'say, word, speech', reading: 'げん / ごん / い(う) / こと' },
          { kanji: '葉', radical: '艹 (grass)',  meaning: 'leaf, foliage',     reading: 'よう / は' },
        ],
      },
    },
  },
  {
    kind:  'comprehension',
    label: 'minimal · word + meaning only',
    note:  'Worst-case sparseness. Definition is alone, no tabs render.',
    card: {
      id:         id('comp-minimal'),
      deckId:     'fixture-deck',
      jlptLevel:  null,
      state:      0,
      due:        new Date().toISOString(),
      layoutType: 'vocabulary',
      fieldsData: {
        word:    '空',
        reading: 'そら',
        meaning: 'sky',
      },
    },
  },
]

export const SESSION_FIXTURES = {
  comprehension: COMP_FIXTURES,
} as const

export function fixturesForKind(kind: FixtureKind): Fixture[] {
  return [...SESSION_FIXTURES[kind]]
}

export function allFixtures(): Fixture[] {
  return [...COMP_FIXTURES]
}

export function fixtureQueueOf(kind: FixtureKind): ApiDueCard[] {
  return SESSION_FIXTURES[kind].map((f) => f.card)
}
