import { z } from 'zod'

export const signupSchema = z.object({
  email:        z.string().email(),
  password:     z.string().min(8),
  display_name: z.string()
    .min(2,  'Display name must be at least 2 characters.')
    .max(30, 'Display name must be at most 30 characters.')
    .trim(),
})

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const cancelSignupSchema = z.object({
  userId: z.string().uuid(),
})

export type SignupInput       = z.infer<typeof signupSchema>
export type LoginInput        = z.infer<typeof loginSchema>
export type RefreshInput      = z.infer<typeof refreshSchema>
export type CancelSignupInput = z.infer<typeof cancelSignupSchema>

