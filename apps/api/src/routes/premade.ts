import { Router } from 'express'

import { authMiddleware }                from '../middleware/auth.ts'
import {
  defaultUserRateLimitMiddleware,
  subscribeRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as premadeController            from '../controllers/premade.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',    premadeController.list)
router.get('/:id', premadeController.get)

// Backend Completion Plan Stage 4 (copy model). Reuses
// `subscribeRateLimitMiddleware` for the same per-user lockout the old
// /:id/subscribe route had — copy clones every source card, same blast
// radius, so the protection still applies. The middleware export keeps
// its historical name to avoid an unrelated rename here; the
// /:id/subscribe and DELETE /:id/subscribe routes are gone.
router.post('/:id/copy', subscribeRateLimitMiddleware, premadeController.copy)

export default router
