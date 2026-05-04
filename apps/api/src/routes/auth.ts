import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import { authRateLimitMiddleware } from '../middleware/rateLimit.ts'
import * as authController from '../controllers/auth.controller.ts'

const router = Router()

// Public — no auth middleware; user is unauthenticated during these flows.
// Rate-limited to deter brute-force on credentials/OTP and email enumeration.
router.post('/signup',        authRateLimitMiddleware, authController.signup)
router.post('/cancel-signup', authRateLimitMiddleware, authController.cancelSignup)
router.post('/login',         authRateLimitMiddleware, authController.login)
router.post('/refresh',       authRateLimitMiddleware, authController.refresh)
router.post('/verify-otp',    authRateLimitMiddleware, authController.verifyOtp)
router.post('/resend-otp',    authRateLimitMiddleware, authController.resendOtp)

// Protected — requires a valid Bearer token.
router.post('/logout',          authMiddleware, authController.logout)
router.delete('/account',       authMiddleware, authController.deleteAccount)

export default router
