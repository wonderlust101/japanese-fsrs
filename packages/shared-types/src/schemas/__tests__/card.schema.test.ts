import { describe, it, expect } from 'bun:test'

import {
  cardMissingFieldEnum,
  cardPresentFieldEnum,
  pitchPatternEnum,
  crossDeckListCardsQuerySchema,
} from '../card.schema.ts'

describe('card.schema — cardMissingFieldEnum', () => {
  it('admits the legacy six tokens plus the new pitch / audio tokens', () => {
    for (const token of ['reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance', 'pitch', 'audio']) {
      expect(cardMissingFieldEnum.safeParse(token).success).toBe(true)
    }
  })

  it('rejects unknown missing-field tokens', () => {
    expect(cardMissingFieldEnum.safeParse('audio_url').success).toBe(false)
    expect(cardMissingFieldEnum.safeParse('').success).toBe(false)
  })
})

describe('card.schema — cardPresentFieldEnum', () => {
  it('admits only picture / pitch / audio', () => {
    for (const token of ['picture', 'pitch', 'audio']) {
      expect(cardPresentFieldEnum.safeParse(token).success).toBe(true)
    }
    // These would be silly for the positive direction — reading/meaning
    // are virtually always populated. Enum stays tight to keep the wire
    // contract small.
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
    expect(crossDeckListCardsQuerySchema.safeParse({ presentField: 'audio' }).success).toBe(true)
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

  it('rejects setting both missingField and presentField (mutually exclusive)', () => {
    const result = crossDeckListCardsQuerySchema.safeParse({
      missingField: 'audio',
      presentField: 'audio',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      // The .refine attaches the error to presentField so the UI knows
      // which control to highlight. Use the message rather than the path
      // index since the issue path may include refine indices.
      const message = result.error.issues.map((i) => i.message).join('|')
      expect(message).toContain('Pass only one of missingField, presentField')
    }
  })

  it('still rejects unknown top-level keys (.strict() is preserved)', () => {
    const result = crossDeckListCardsQuerySchema.safeParse({
      missingField: 'audio',
      bogusKey:     'x',
    })
    expect(result.success).toBe(false)
  })

  it('preserves the limit coercion + cap', () => {
    expect(crossDeckListCardsQuerySchema.safeParse({ limit: '50' }).success).toBe(true)
    expect(crossDeckListCardsQuerySchema.safeParse({ limit: 9999 }).success).toBe(false)
  })
})
