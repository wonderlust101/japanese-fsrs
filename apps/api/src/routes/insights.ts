import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import { defaultUserRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as insightsController from '../controllers/insights.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/card-quality',       insightsController.cardQuality)
router.get('/maturity-history',   insightsController.maturityHistory)
router.get('/distributions',      insightsController.distributions)

export default router
