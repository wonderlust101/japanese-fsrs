import type { RequestHandler } from 'express'

import { generateCardInputSchema } from '../schemas/ai.schema.ts'
import * as aiService      from '../services/ai.service.ts'
import * as profileService from '../services/profile.service.ts'

/**
 * POST /api/v1/ai/generate-card
 * Generates structured card data for a Japanese word using the authenticated
 * user's JLPT level and interests as personalisation context.
 */
export const generateCard: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { word }  = generateCardInputSchema.parse(req.body)
    const profile   = await profileService.getProfile(req.user.id)
    const userLevel = profile.jlpt_target ?? 'N5'
    const interests = profile.interests   ?? []

    const data = await aiService.generateCard(word, userLevel, interests)
    res.json(data)
  } catch (err) {
    next(err)
  }
}
