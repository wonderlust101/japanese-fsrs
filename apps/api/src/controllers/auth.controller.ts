import type { RequestHandler } from 'express'

import { signupSchema, loginSchema, refreshSchema } from '../schemas/auth.schema.ts'
import * as authService from '../services/auth.service.ts'

export const signup: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = signupSchema.parse(req.body)
    const result = await authService.signup(input)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const login: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = loginSchema.parse(req.body)
    const result = await authService.login(input)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const refresh: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input  = refreshSchema.parse(req.body)
    const result = await authService.refresh(input)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const logout: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    // authMiddleware already verified this header; safe to re-extract the token.
    const jwt = (req.headers.authorization as string).slice('Bearer '.length)
    await authService.logout(jwt)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
