import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import { defaultUserRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as leechesController from '../controllers/leeches.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',    leechesController.list)
router.get('/:id', leechesController.get)

router.post('/:id/resolve', leechesController.resolve)
router.post('/:id/reopen',  leechesController.reopen)

export default router
