import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import * as authController from '../controllers/auth.controller.ts'

const router = Router()

router.post('/signup',  authController.signup)
router.post('/login',   authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout',  authMiddleware, authController.logout)

export default router
