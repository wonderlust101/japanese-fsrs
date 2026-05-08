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
  const { cardId, count } = generateSentencesInputSchema.parse(req.body)

  // Card lookup is scoped to user_id, so a wrong-owner request returns 404.
  const card    = await cardService.getCard(cardId, req.user.id)
  const profile = await profileService.getProfile(req.user.id)
  const word    = getWordFields(card)?.word ?? ''

  if (word.length === 0) {
    // 422 = well-formed body but the referenced card lacks the data we need.
    throw new AppError(422, 'Card has no `word` field to generate sentences for', { code: 'CARD_FIELDS_INSUFFICIENT' })
  }

  const data = await aiService.generateSentences(
    word,
    profile.jlptTarget ?? 'N5',
    profile.interests   ?? [],
    count ?? 3,
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
