import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import {
  defaultUserRateLimitMiddleware,
  resourceDeleteRateLimitMiddleware,
  subscribeRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as decksController from '../controllers/decks.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',     decksController.list)
router.post('/',    decksController.create)
router.get('/:id',  decksController.get)
router.patch('/:id', decksController.update)
router.delete('/:id', resourceDeleteRateLimitMiddleware, decksController.remove)

// Deck duplication. Reuses `subscribeRateLimitMiddleware` because the blast
// radius matches the premade-copy path: every non-suspended source card is
// cloned. The middleware's prefix/error code keep their historical names to
// avoid an unrelated rename here.
router.post('/:id/copy', subscribeRateLimitMiddleware, decksController.copy)

export default router
