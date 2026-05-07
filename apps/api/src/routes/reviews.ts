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

export default router
