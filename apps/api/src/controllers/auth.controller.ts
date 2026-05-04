import type { RequestHandler } from 'express'

import { signupSchema, loginSchema, refreshSchema, cancelSignupSchema, verifyOtpSchema, resendOtpSchema } from '../schemas/auth.schema.ts'
import * as authService from '../services/auth.service.ts'

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
    // authMiddleware already verified this header; safe to re-extract the token.
    const jwt = (req.headers.authorization as string).slice('Bearer '.length)
    await authService.signOut(jwt)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const deleteAccount: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    await authService.deleteAccount(req.user.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
