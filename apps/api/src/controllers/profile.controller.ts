import type { RequestHandler } from 'express'

import { updateProfileSchema } from '@fsrs-japanese/shared-types'
import * as profileService from '../services/profile.service.ts'

/**
 * GET /api/v1/profile
 * Returns the authenticated user's profile.
 */
export const getProfile: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const profile = await profileService.getProfile(req.user.id)
    res.json(profile)
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/profile
 * Partially updates the authenticated user's profile.
 * Only fields present in the request body are written.
 */
export const updateProfile: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input   = updateProfileSchema.parse(req.body)
    const profile = await profileService.updateProfile(req.user.id, input)
    res.json(profile)
  } catch (err) {
    next(err)
  }
}
