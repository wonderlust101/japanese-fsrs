import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import { defaultUserRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as insightsController from '../controllers/insights.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/problem-cards', insightsController.problemCards)
router.get('/card-quality',  insightsController.cardQuality)

export default router
