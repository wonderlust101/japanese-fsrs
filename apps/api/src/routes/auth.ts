import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import * as authController from '../controllers/auth.controller.ts'

const router = Router()

// Public — no auth middleware; user is unauthenticated during these flows.
router.post('/signup',        authController.signup)
router.post('/cancel-signup', authController.cancelSignup)
router.post('/verify-otp', authController.verifyOtp)
router.post('/login',      authController.login)
router.post('/refresh',    authController.refresh)

// Protected — requires a valid Bearer token.
router.post('/logout', authMiddleware, authController.logout)

export default router
