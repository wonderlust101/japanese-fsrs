import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import { defaultUserRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as leechesController from '../controllers/leeches.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',    leechesController.list)

// Literal-path drill-sessions routes must be registered before any `:id`
// parameterized route so Express's first-match routing can't capture
// 'drill-sessions' as a leech UUID. The GET sits next to the POST so the
// route file documents the full create+resume contract in one place.
router.post('/drill-sessions',                      leechesController.createDrillSession)
router.get ('/drill-sessions/:sessionId',           leechesController.getDrillSession)
router.post('/drill-sessions/:sessionId/attempts',  leechesController.recordDrillAttempt)

router.get('/:id', leechesController.get)

router.post('/:id/resolve', leechesController.resolve)
router.post('/:id/reopen',  leechesController.reopen)

export default router
