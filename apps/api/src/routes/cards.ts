import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import * as cardsController from '../controllers/cards.controller.ts'

// mergeParams: true so req.params.deckId is accessible when this router is
// mounted at /api/v1/decks/:deckId/cards.
const router = Router({ mergeParams: true })

router.get('/',             authMiddleware, cardsController.list)
router.post('/',            authMiddleware, cardsController.create)
router.get('/:id',          authMiddleware, cardsController.get)
router.patch('/:id',        authMiddleware, cardsController.update)
router.delete('/:id',       authMiddleware, cardsController.remove)
router.get('/:id/similar',  authMiddleware, cardsController.similar)

export default router
