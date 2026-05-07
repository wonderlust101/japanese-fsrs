import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import {
  defaultUserRateLimitMiddleware,
  resourceDeleteRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as decksController from '../controllers/decks.controller.ts'

const router = Router()

router.use(authMiddleware, defaultUserRateLimitMiddleware)

router.get('/',     decksController.list)
router.post('/',    decksController.create)
router.get('/:id',  decksController.get)
router.patch('/:id', decksController.update)
router.delete('/:id', resourceDeleteRateLimitMiddleware, decksController.remove)

export default router
