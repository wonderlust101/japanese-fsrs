import { Router } from 'express'

import { authMiddleware }        from '../middleware/auth.ts'
import {
  aiRateLimitMiddleware,
  aiDailyQuotaMiddleware,
  defaultUserRateLimitMiddleware,
  resourceDeleteRateLimitMiddleware,
  similarSearchRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as cardsController     from '../controllers/cards.controller.ts'

// mergeParams: true so req.params.deckId is accessible when this router is
// mounted at /api/v1/decks/:deckId/cards.
const router = Router({ mergeParams: true })

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',                          cardsController.list)
// Cross-deck browser list. Registered before `/:id` so the literal segment
// wins routing precedence (Express matches in declaration order, but being
// explicit avoids surprises if the route table is reordered).
router.get('/cross-deck',                cardsController.listCrossDeck)
// Card creation has an AI path (`{ word: ... }`) that hits OpenAI; gate it
// behind the AI minute-rate limit AND the AI daily quota. The manual path
// (`{ fieldsData: ... }`) shares both budgets — acceptable since manual
// creation is human-driven and the 200/24h ceiling is well above any
// realistic UI session.
router.post('/',                         aiRateLimitMiddleware, aiDailyQuotaMiddleware, cardsController.create)
router.get('/:id',                       cardsController.get)
router.patch('/:id',                     cardsController.update)
router.delete('/:id',                    resourceDeleteRateLimitMiddleware, cardsController.remove)
router.get('/:id/similar',               similarSearchRateLimitMiddleware, cardsController.similar)
router.post('/:id/regenerate-embedding', aiRateLimitMiddleware, aiDailyQuotaMiddleware, cardsController.regenerateEmbedding)

// Stage 8 — manual recovery operations on a single card. Default
// (240/min/user) rate limiter is sufficient: these are scalar UPDATEs with
// no external service calls, fired rarely from the UI (a learner doesn't
// forget or reschedule in tight loops).
router.post('/:id/forget',     cardsController.forget)
router.post('/:id/reschedule', cardsController.reschedule)

// /cards browser mutations. Scalar UPDATEs / atomic INSERTs — no external
// service calls — so the default 240/min/user backstop is enough. Each is
// idempotent via Idempotency-Key (see controllers).
router.post('/:id/move',      cardsController.move)
router.post('/:id/copy',      cardsController.copy)
router.post('/:id/suspend',   cardsController.suspend)
router.post('/:id/unsuspend', cardsController.unsuspend)

// Bulk operations. Capped at 500 ids per call by the Zod schema; share the
// resource-delete rate limiter (120/min/user) because a tight loop of
// bulk-deletes could shed deck rollups faster than any other surface.
router.post('/bulk/move',      resourceDeleteRateLimitMiddleware, cardsController.bulkMove)
router.post('/bulk/suspend',   resourceDeleteRateLimitMiddleware, cardsController.bulkSuspend)
router.post('/bulk/unsuspend', resourceDeleteRateLimitMiddleware, cardsController.bulkUnsuspend)
router.post('/bulk/delete',    resourceDeleteRateLimitMiddleware, cardsController.bulkDelete)
router.post('/bulk/tag',       resourceDeleteRateLimitMiddleware, cardsController.bulkTag)

export default router
