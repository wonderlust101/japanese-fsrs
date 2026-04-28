import { z } from 'zod'

export const signupSchema = z.object({
  email:        z.email(),
  password:     z.string().min(8),
  display_name: z.string()
    .min(2,  'Display name must be at least 2 characters.')
    .max(30, 'Display name must be at most 30 characters.')
    .trim(),
})

export const loginSchema = z.object({
  email:    z.email(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const cancelSignupSchema = z.object({
  userId: z.string().uuid(),
})

export const verifyOtpSchema = z.object({
  email: z.email(),
  token: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be digits only'),
})

export const resendOtpSchema = z.object({
  email: z.email(),
})

export type SignupInput       = z.infer<typeof signupSchema>
export type LoginInput        = z.infer<typeof loginSchema>
export type RefreshInput      = z.infer<typeof refreshSchema>
export type CancelSignupInput = z.infer<typeof cancelSignupSchema>
export type VerifyOtpInput    = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput    = z.infer<typeof resendOtpSchema>

