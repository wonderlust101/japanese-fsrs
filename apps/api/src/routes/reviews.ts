import { Router } from 'express'

import { authMiddleware }                                  from '../middleware/auth.ts'
import { batchRateLimitMiddleware, submitRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as reviewsController                              from '../controllers/reviews.controller.ts'

const router = Router()

router.get('/due',                          authMiddleware, reviewsController.getDue)
router.post('/submit',                      authMiddleware, submitRateLimitMiddleware, reviewsController.submit)
router.post('/batch',                       authMiddleware, batchRateLimitMiddleware, reviewsController.batch)
router.get('/forecast',                     authMiddleware, reviewsController.forecast)
router.get('/session-summary/:sessionId',   authMiddleware, reviewsController.sessionSummary)

export default router
