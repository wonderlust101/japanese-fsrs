import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import {
  aiDailyQuotaMiddleware,
  aiRateLimitMiddleware,
  defaultUserRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as weakSpotsController from '../controllers/weak-spots.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',    weakSpotsController.list)

// Literal-path drill-sessions routes must be registered before any `:id`
// parameterized route so Express's first-match routing can't capture
// 'drill-sessions' as a weakSpot UUID. The GET sits next to the POST so the
// route file documents the full create+resume contract in one place.
router.post('/drill-sessions',                      weakSpotsController.createDrillSession)
router.get ('/drill-sessions/:sessionId',           weakSpotsController.getDrillSession)
router.post('/drill-sessions/:sessionId/attempts',  weakSpotsController.recordDrillAttempt)
router.post('/drill-sessions/:sessionId/finish',    weakSpotsController.finishDrillSession)
router.post('/drill-sessions/:sessionId/abort',     weakSpotsController.abortDrillSession)

router.get('/:id', weakSpotsController.get)

router.post('/:id/resolve', weakSpotsController.resolve)
router.post('/:id/reopen',  weakSpotsController.reopen)

// Diagnosis is an AI feature: stack the AI rate limiter + daily quota in
// front of the default user-rate-limit middleware that's already on the
// router. Stage 7 made diagnosis a free MVP feature, so the only gates are
// auth + the cost-control limiters.
router.post(
  '/:id/diagnose',
  aiRateLimitMiddleware,
  aiDailyQuotaMiddleware,
  weakSpotsController.diagnoseWeakSpot,
)

export default router
