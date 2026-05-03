import { Router } from 'express'

import { authMiddleware }     from '../middleware/auth.ts'
import * as reviewsController from '../controllers/reviews.controller.ts'

const router = Router()

router.get('/due',      authMiddleware, reviewsController.getDue)
router.post('/submit',  authMiddleware, reviewsController.submit)
router.post('/batch',   authMiddleware, reviewsController.batch)
router.get('/forecast', authMiddleware, reviewsController.forecast)

export default router
