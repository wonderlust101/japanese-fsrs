import { describe, it, expect } from 'bun:test'

import {
  ExampleSentenceSchema,
  WordFieldsSchema,
  VocabularyFieldsDataSchema,
  GrammarFieldsDataSchema,
  FieldsDataSchema,
} from '../field-shapes.schema.ts'

// Lapis-style schema admission (Backend Completion Plan, Stage 1). These
// tests pin the wire shape so a future PR cannot strip the Lapis keys via
// `.parse()` without surfacing here. Round-trip parsing is what proves the
// keys survive — the schema's default behaviour is to drop unknown keys, so
// a missing field on the schema would silently disappear on every API
// response. See packages/shared-types/src/schemas/field-shapes.schema.ts.

describe('WordFieldsSchema — Lapis-style fields', () => {
  it('admits and round-trips picture, expressionAudio, pitchPosition, nuance', () => {
    const input = {
      word:            '猫',
      reading:         'ねこ',
      meaning:         'cat',
      picture:         'https://cdn.example.test/neko.jpg',
      expressionAudio: 'https://cdn.example.test/neko.mp3',
      pitchPosition:   0,
      nuance:          'Casual register; covers domestic and stray cats alike.',
    }
    const parsed = WordFieldsSchema.parse(input)
    expect(parsed).toEqual(input)
  })

  it('accepts the new fields as null (explicit "no signal")', () => {
    const parsed = WordFieldsSchema.parse({
      word:            '犬',
      reading:         'いぬ',
      meaning:         'dog',
      picture:         null,
      expressionAudio: null,
      pitchPosition:   null,
      nuance:          null,
    })
    expect(parsed.picture).toBeNull()
    expect(parsed.expressionAudio).toBeNull()
    expect(parsed.pitchPosition).toBeNull()
    expect(parsed.nuance).toBeNull()
  })

  it('accepts the new fields as omitted (legacy shape)', () => {
    const parsed = WordFieldsSchema.parse({
      word:    '鳥',
      reading: 'とり',
      meaning: 'bird',
    })
    // Omitted optional fields stay omitted — not coerced to null/undefined keys.
    expect('picture'         in parsed).toBe(false)
    expect('expressionAudio' in parsed).toBe(false)
    expect('pitchPosition'   in parsed).toBe(false)
    expect('nuance'          in parsed).toBe(false)
  })

  it('rejects a negative pitchPosition', () => {
    const result = WordFieldsSchema.safeParse({
      word:          '雨',
      reading:       'あめ',
      meaning:       'rain',
      pitchPosition: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-integer pitchPosition', () => {
    const result = WordFieldsSchema.safeParse({
      word:          '雪',
      reading:       'ゆき',
      meaning:       'snow',
      pitchPosition: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('ExampleSentenceSchema — Lapis-style sentenceAudio', () => {
  it('admits and round-trips sentenceAudio', () => {
    const input = {
      ja:            '猫が好きです。',
      en:            'I like cats.',
      furigana:      'ねこがすきです。',
      sentenceAudio: 'https://cdn.example.test/sentence-001.mp3',
    }
    const parsed = ExampleSentenceSchema.parse(input)
    expect(parsed).toEqual(input)
  })

  it('accepts sentenceAudio as null', () => {
    const parsed = ExampleSentenceSchema.parse({
      ja:            'これは本です。',
      en:            'This is a book.',
      furigana:      'これはほんです。',
      sentenceAudio: null,
    })
    expect(parsed.sentenceAudio).toBeNull()
  })

  it('accepts the legacy three-key shape unchanged', () => {
    const parsed = ExampleSentenceSchema.parse({
      ja:       'これは本です。',
      en:       'This is a book.',
      furigana: 'これはほんです。',
    })
    expect('sentenceAudio' in parsed).toBe(false)
  })
})

describe('VocabularyFieldsDataSchema — composition with Lapis fields', () => {
  it('round-trips a fully populated vocabulary card with nested sentenceAudio', () => {
    const input = {
      word:            '空',
      reading:         'そら',
      meaning:         'sky',
      pitchPosition:   1,
      nuance:          'The visible sky; for "outer space" use 宇宙.',
      picture:         'https://cdn.example.test/sora.jpg',
      expressionAudio: 'https://cdn.example.test/sora.mp3',
      exampleSentences: [
        {
          ja:            '空が青いです。',
          en:            'The sky is blue.',
          furigana:      'そらがあおいです。',
          sentenceAudio: 'https://cdn.example.test/sora-blue.mp3',
        },
      ],
      pitchAccent: '[1]',
    }
    const parsed = VocabularyFieldsDataSchema.parse(input)
    expect(parsed).toEqual(input)
  })

  it('parses cleanly through the FieldsDataSchema union', () => {
    const parsed = FieldsDataSchema.parse({
      word:          '鏡',
      reading:       'かがみ',
      meaning:       'mirror',
      pitchPosition: 3,
      nuance:        'Refers to a physical mirror; the metaphorical "reflection" uses 反映.',
    })
    // Discriminator lives on the parent card's layoutType, not in the JSON
    // itself — the union narrows structurally.
    expect((parsed as { pitchPosition?: number }).pitchPosition).toBe(3)
  })
})

describe('GrammarFieldsDataSchema — inherits Lapis fields from WordFieldsSchema', () => {
  it('admits picture and nuance on a grammar pattern', () => {
    const input = {
      word:    '〜てしまう',
      reading: 'てしまう',
      meaning: 'do completely / regrettably',
      nuance:  'Carries a sense of regret or finality; the casual contraction is 〜ちゃう.',
      picture: 'https://cdn.example.test/teshimau.svg',
    }
    const parsed = GrammarFieldsDataSchema.parse(input)
    expect(parsed).toEqual(input)
  })
})
