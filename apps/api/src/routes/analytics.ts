import { Router } from 'express'

import { authMiddleware }       from '../middleware/auth.ts'
import * as analyticsController from '../controllers/analytics.controller.ts'

const router = Router()

router.get('/heatmap',    authMiddleware, analyticsController.heatmap)
router.get('/accuracy',   authMiddleware, analyticsController.accuracy)
router.get('/streak',     authMiddleware, analyticsController.streak)
router.get('/jlpt-gap',   authMiddleware, analyticsController.jlptGap)
router.get('/milestones', authMiddleware, analyticsController.milestones)

export default router
