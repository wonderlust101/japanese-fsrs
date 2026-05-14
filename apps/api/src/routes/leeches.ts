import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import {
  aiDailyQuotaMiddleware,
  aiRateLimitMiddleware,
  defaultUserRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
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
router.post('/drill-sessions/:sessionId/finish',    leechesController.finishDrillSession)
router.post('/drill-sessions/:sessionId/abort',     leechesController.abortDrillSession)

router.get('/:id', leechesController.get)

router.post('/:id/resolve', leechesController.resolve)
router.post('/:id/reopen',  leechesController.reopen)

// Diagnosis is an AI feature: stack the AI rate limiter + daily quota in
// front of the default user-rate-limit middleware that's already on the
// router. Stage 7 made diagnosis a free MVP feature, so the only gates are
// auth + the cost-control limiters.
router.post(
  '/:id/diagnose',
  aiRateLimitMiddleware,
  aiDailyQuotaMiddleware,
  leechesController.diagnoseLeech,
)

export default router
