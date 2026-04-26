import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import * as profileController from '../controllers/profile.controller.ts'

const router = Router()

router.get('/',   authMiddleware, profileController.getProfile)
router.patch('/', authMiddleware, profileController.updateProfile)

export default router
