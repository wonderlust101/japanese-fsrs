import { Router } from 'express'

import { authMiddleware }       from '../middleware/auth.ts'
import {
  analyticsDashboardRateLimitMiddleware,
  defaultUserRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as analyticsController from '../controllers/analytics.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/dashboard',  analyticsDashboardRateLimitMiddleware, analyticsController.dashboard)
router.get('/heatmap',    analyticsController.heatmap)
router.get('/accuracy',   analyticsController.accuracy)
router.get('/streak',     analyticsController.streak)
router.get('/jlpt-gap',   analyticsController.jlptGap)
router.get('/milestones', analyticsController.milestones)

export default router
