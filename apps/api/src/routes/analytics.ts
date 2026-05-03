import { Router } from 'express'

import { authMiddleware }       from '../middleware/auth.ts'
import * as analyticsController from '../controllers/analytics.controller.ts'

const router = Router()

router.get('/heatmap',  authMiddleware, analyticsController.heatmap)
router.get('/accuracy', authMiddleware, analyticsController.accuracy)

export default router
