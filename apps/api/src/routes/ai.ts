import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import {
  aiRateLimitMiddleware,
  aiDailyQuotaMiddleware,
  defaultUserRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as aiController         from '../controllers/ai.controller.ts'

const router = Router()

// Every AI route runs auth → backstop → AI minute-rate → AI daily quota.
router.use(
  authMiddleware,
  defaultUserRateLimitMiddleware,
  aiRateLimitMiddleware,
  aiDailyQuotaMiddleware,
)

router.post('/generate-card',      aiController.generateCard)
router.post('/generate-sentences', aiController.generateSentences)
router.post('/generate-mnemonic',  aiController.generateMnemonic)

export default router
