import { describe, it, expect } from 'bun:test'

import {
  cardMissingFieldEnum,
  cardPresentFieldEnum,
  pitchPatternEnum,
  crossDeckListCardsQuerySchema,
} from '../card.schema.ts'

describe('card.schema — cardMissingFieldEnum', () => {
  it('admits the supported missing-field tokens', () => {
    for (const token of ['reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance', 'pitch']) {
      expect(cardMissingFieldEnum.safeParse(token).success).toBe(true)
    }
  })

  it('rejects unknown missing-field tokens, including the removed audio dimension', () => {
    expect(cardMissingFieldEnum.safeParse('audio').success).toBe(false)
    expect(cardMissingFieldEnum.safeParse('audio_url').success).toBe(false)
    expect(cardMissingFieldEnum.safeParse('').success).toBe(false)
  })
})

describe('card.schema — cardPresentFieldEnum', () => {
  it('admits only picture / pitch', () => {
    for (const token of ['picture', 'pitch']) {
      expect(cardPresentFieldEnum.safeParse(token).success).toBe(true)
    }
    // These would be silly for the positive direction — reading/meaning
    // are virtually always populated. Enum stays tight to keep the wire
    // contract small. `audio` was removed alongside the audio fields.
    expect(cardPresentFieldEnum.safeParse('audio').success).toBe(false)
    expect(cardPresentFieldEnum.safeParse('reading').success).toBe(false)
    expect(cardPresentFieldEnum.safeParse('mnemonic').success).toBe(false)
  })
})

describe('card.schema — pitchPatternEnum', () => {
  it('admits the four canonical pattern classes', () => {
    for (const token of ['heiban', 'atamadaka', 'nakadaka', 'odaka']) {
      expect(pitchPatternEnum.safeParse(token).success).toBe(true)
    }
  })

  it('rejects romanizations and other variants', () => {
    expect(pitchPatternEnum.safeParse('Heiban').success).toBe(false) // case-sensitive
    expect(pitchPatternEnum.safeParse('flat').success).toBe(false)
  })
})

describe('card.schema — crossDeckListCardsQuerySchema', () => {
  it('accepts each new presence + pattern field individually', () => {
    expect(crossDeckListCardsQuerySchema.safeParse({ presentField: 'picture' }).success).toBe(true)
    expect(crossDeckListCardsQuerySchema.safeParse({ missingField: 'pitch' }).success).toBe(true)
    expect(crossDeckListCardsQuerySchema.safeParse({ pitchPattern: 'atamadaka' }).success).toBe(true)
  })

  it('allows presentField + pitchPattern together (positive-direction combination)', () => {
    // The combination "has pitch + pattern = nakadaka" is the canonical
    // pitch-pattern study flow; it must be admitted.
    const result = crossDeckListCardsQuerySchema.safeParse({
      presentField: 'pitch',
      pitchPattern: 'nakadaka',
    })
    expect(result.success).toBe(true)
  })

  it('admits cross-dimension combinations of missingField and presentField', () => {
    // Migration 20260624000001 relaxed the mutual-exclusion guard so the
    // popover can naturally express "has X AND missing Y" combinations.
    // Same-dimension contradictions remain impossible by widget design
    // on the client (single segmented control per dimension).
    const result = crossDeckListCardsQuerySchema.safeParse({
      presentField: 'picture',
      missingField: 'mnemonic',
    })
    expect(result.success).toBe(true)
  })

  it('still rejects unknown top-level keys (.strict() is preserved)', () => {
    const result = crossDeckListCardsQuerySchema.safeParse({
      missingField: 'pitch',
      bogusKey:     'x',
    })
    expect(result.success).toBe(false)
  })

  it('preserves the limit coercion + cap', () => {
    expect(crossDeckListCardsQuerySchema.safeParse({ limit: '50' }).success).toBe(true)
    expect(crossDeckListCardsQuerySchema.safeParse({ limit: 9999 }).success).toBe(false)
  })
})
