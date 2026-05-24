import type { RequestHandler } from 'express'

import { AppError } from '../middleware/errorHandler.ts'
import {
  generateCardInputSchema,
  generateSentencesInputSchema,
  generateMnemonicInputSchema,
  getWordFields,
} from '@fsrs-japanese/shared-types'
import * as aiService      from '../services/ai.service.ts'
import * as cardService    from '../services/card.service.ts'
import * as deckService    from '../services/deck.service.ts'
import * as profileService from '../services/profile.service.ts'

/**
 * POST /api/v1/ai/generate-card
 * Generates structured card data for a Japanese word using the authenticated
 * user's JLPT level and interests as personalisation context.
 */
export const generateCard: RequestHandler = async (req, res): Promise<void> => {
  const { word }  = generateCardInputSchema.parse(req.body)
  const profile   = await profileService.getProfile(req.user.id)
  const userLevel = profile.jlptTarget ?? 'N5'
  const interests = profile.interests   ?? []

  const data = await aiService.generateCard(word, userLevel, interests, { signal: req.signal })
  res.json(data)
}

/**
 * POST /api/v1/ai/generate-sentences
 * Generates fresh example sentences for a card the user owns.
 */
export const generateSentences: RequestHandler = async (req, res): Promise<void> => {
  const input = generateSentencesInputSchema.parse(req.body)

  // Two source paths (the schema guarantees exactly one is set):
  //   - cardId: a saved card. Assert the deck is active (freeze AI spend on
  //     archived decks before the OpenAI call) and look the word up server-side.
  //   - word:   the /add/review pre-save path, where no card exists yet.
  let word = ''
  if (input.cardId !== undefined) {
    await deckService.assertCardDeckActive(input.cardId, req.user.id)
    // Card lookup is scoped to user_id, so a wrong-owner request returns 404.
    const card = await cardService.getCard(input.cardId, req.user.id)
    word = getWordFields(card)?.word ?? ''
    if (word.length === 0) {
      // 422 = well-formed body but the referenced card lacks the data we need.
      throw new AppError(422, 'Card has no `word` field to generate sentences for', { code: 'CARD_FIELDS_INSUFFICIENT' })
    }
  } else if (input.word !== undefined) {
    word = input.word
  }

  const profile = await profileService.getProfile(req.user.id)
  const data = await aiService.generateSentences(
    word,
    profile.jlptTarget ?? 'N5',
    profile.interests   ?? [],
    input.count ?? 3,
    input.avoid ?? [],
    { signal: req.signal },
  )
  res.json(data)
}

/**
 * POST /api/v1/ai/generate-mnemonic
 * Generates a fresh mnemonic for a card the user owns.
 */
export const generateMnemonic: RequestHandler = async (req, res): Promise<void> => {
  const { cardId } = generateMnemonicInputSchema.parse(req.body)

  // See `generateSentences` — same archived-deck rationale.
  await deckService.assertCardDeckActive(cardId, req.user.id)

  const card    = await cardService.getCard(cardId, req.user.id)
  const profile = await profileService.getProfile(req.user.id)
  const word    = getWordFields(card)?.word ?? ''

  if (word.length === 0) {
    // 422 = well-formed body but the referenced card lacks the data we need.
    throw new AppError(422, 'Card has no `word` field to generate a mnemonic for', { code: 'CARD_FIELDS_INSUFFICIENT' })
  }

  const data = await aiService.generateMnemonic(
    word,
    req.user.id,
    profile.jlptTarget ?? 'N5',
    profile.nativeLanguage,
    profile.interests ?? [],
    { signal: req.signal },
  )
  res.json(data)
}
