import { Router } from 'express'

import { authMiddleware }                                  from '../middleware/auth.ts'
import {
  batchRateLimitMiddleware,
  defaultUserRateLimitMiddleware,
  submitRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as reviewsController                              from '../controllers/reviews.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/due',                          reviewsController.getDue)
router.post('/submit',                      submitRateLimitMiddleware, reviewsController.submit)
router.post('/batch',                       batchRateLimitMiddleware, reviewsController.batch)
router.get('/forecast',                     reviewsController.forecast)
router.get('/session-summary/:sessionId',   reviewsController.sessionSummary)

// Stage 8 — rollback a specific review_log by its id. The path is keyed on
// reviewLogId (not cardId) because the log already references its card
// internally. Inherits auth + default rate limiter from `router.use(...)`.
router.post('/:reviewLogId/rollback',       reviewsController.rollback)

export default router
