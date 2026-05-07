import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import { defaultUserRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as profileController from '../controllers/profile.controller.ts'

const router = Router()

// All routes require auth + the per-user backstop limiter (240/min).
router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',   profileController.getProfile)
router.patch('/', profileController.updateProfile)

export default router
