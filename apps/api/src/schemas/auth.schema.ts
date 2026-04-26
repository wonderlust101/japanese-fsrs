import { z } from 'zod'

export const signupSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  username: z.string()
    .min(3,  'Username must be at least 3 characters.')
    .max(20, 'Username must be at most 20 characters.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens.'),
})

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6).regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
})

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export type SignupInput    = z.infer<typeof signupSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type LoginInput     = z.infer<typeof loginSchema>
export type RefreshInput   = z.infer<typeof refreshSchema>
