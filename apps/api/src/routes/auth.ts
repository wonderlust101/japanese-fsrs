import { Router } from 'express'

import { authMiddleware } from '../middleware/auth.ts'
import {
  authRateLimitMiddleware,
  authOtpVerifyRateLimitMiddleware,
  accountDeleteRateLimitMiddleware,
  passwordChangeRateLimitMiddleware,
} from '../middleware/rateLimit.ts'
import * as authController from '../controllers/auth.controller.ts'

const router = Router()

// Public — no auth middleware; user is unauthenticated during these flows.
// Rate-limited to deter brute-force on credentials/OTP and email enumeration.
router.post('/signup',        authRateLimitMiddleware, authController.signup)
router.post('/cancel-signup', authRateLimitMiddleware, authController.cancelSignup)
router.post('/login',         authRateLimitMiddleware, authController.login)
router.post('/refresh',       authRateLimitMiddleware, authController.refresh)
router.post('/verify-otp',    authRateLimitMiddleware, authOtpVerifyRateLimitMiddleware, authController.verifyOtp)
router.post('/resend-otp',    authRateLimitMiddleware, authController.resendOtp)

// Protected — requires a valid Bearer token.
router.post('/logout',          authMiddleware, authController.logout)
// Password change requires the current password (step-up). 5/15min/user
// limiter bounds brute-forcing the current-password field.
router.post('/change-password', authMiddleware, passwordChangeRateLimitMiddleware, authController.changePassword)
// Account deletion also requires the current password (step-up).
router.delete('/account',       authMiddleware, accountDeleteRateLimitMiddleware, authController.deleteAccount)

export default router
