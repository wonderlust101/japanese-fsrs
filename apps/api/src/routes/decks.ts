import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import * as decksController from '../controllers/decks.controller.ts'

const router = Router()

router.get('/',     authMiddleware, decksController.list)
router.post('/',    authMiddleware, decksController.create)
router.get('/:id',  authMiddleware, decksController.get)
router.patch('/:id', authMiddleware, decksController.update)
router.delete('/:id', authMiddleware, decksController.remove)

export default router
