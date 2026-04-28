import { Router } from 'express'

import { authMiddleware }        from '../middleware/auth.ts'
import { aiRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as aiController         from '../controllers/ai.controller.ts'

const router = Router()

router.post('/generate-card', authMiddleware, aiRateLimitMiddleware, aiController.generateCard)

export default router
