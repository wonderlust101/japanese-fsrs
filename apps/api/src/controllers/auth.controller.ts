import type { RequestHandler } from 'express'

import {
  signupSchema, loginSchema, refreshSchema, cancelSignupSchema,
  verifyOtpSchema, resendOtpSchema,
  changePasswordSchema, deleteAccountSchema,
} from '@fsrs-japanese/shared-types'
import * as authService from '../services/auth.service.ts'
import { AppError } from '../middleware/errorHandler.ts'

export const cancelSignup: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input = cancelSignupSchema.parse(req.body)
    await authService.cancelSignup(input)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const signup: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = signupSchema.parse(req.body)
    const result = await authService.signUp(input)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const login: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = loginSchema.parse(req.body)
    const result = await authService.signInWithPassword(input)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const refresh: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = refreshSchema.parse(req.body)
    const result = await authService.refreshSession(input)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const verifyOtp: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = verifyOtpSchema.parse(req.body)
    const result = await authService.verifyOtp(input)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const resendOtp: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input = resendOtpSchema.parse(req.body)
    await authService.resendOtp(input)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const logout: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    // authMiddleware already verified the bearer token, but re-validate the
    // header rather than trusting it — middleware misconfig must not crash here.
    const auth = req.headers.authorization
    if (auth === undefined || !auth.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing bearer token')
    }
    await authService.signOut(auth.slice('Bearer '.length))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const changePassword: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input = changePasswordSchema.parse(req.body)
    const email = req.user.email
    if (typeof email !== 'string' || email.length === 0) {
      // Defensive: every authenticated Supabase user has an email. If we ever
      // see a session without one, fail loudly rather than skipping the step-up.
      throw new AppError(401, 'Invalid session')
    }
    await authService.changePassword(req.user.id, email, input.currentPassword, input.newPassword)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const deleteAccount: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input = deleteAccountSchema.parse(req.body)
    const email = req.user.email
    if (typeof email !== 'string' || email.length === 0) {
      throw new AppError(401, 'Invalid session')
    }
    await authService.deleteAccount(req.user.id, email, input.currentPassword)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
