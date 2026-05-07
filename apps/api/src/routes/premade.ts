import { Router } from 'express'

import { authMiddleware }                from '../middleware/auth.ts'
import {
  defaultUserRateLimitMiddleware,
  subscribeRateLimitMiddleware,
  unsubscribeRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as premadeController            from '../controllers/premade.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

// Subscriptions list — must be defined before the `/:id` param route so the
// literal segment isn't swallowed.
router.get('/subscriptions/me', premadeController.subscriptions)

router.get('/',                premadeController.list)
router.get('/:id',             premadeController.get)
router.post('/:id/subscribe',  subscribeRateLimitMiddleware, premadeController.subscribe)
router.delete('/:id/subscribe', unsubscribeRateLimitMiddleware, premadeController.unsubscribe)

export default router
