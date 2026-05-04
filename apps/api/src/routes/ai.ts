import { Router } from 'express'

import { authMiddleware }        from '../middleware/auth.ts'
import { aiRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as aiController         from '../controllers/ai.controller.ts'

const router = Router()

router.post('/generate-card',      authMiddleware, aiRateLimitMiddleware, aiController.generateCard)
router.post('/generate-sentences', authMiddleware, aiRateLimitMiddleware, aiController.generateSentences)
router.post('/generate-mnemonic',  authMiddleware, aiRateLimitMiddleware, aiController.generateMnemonic)

export default router
