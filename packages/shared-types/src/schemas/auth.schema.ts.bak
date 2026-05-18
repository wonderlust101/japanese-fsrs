import { z } from 'zod'

import { safeShortText } from '../sanitize.ts'

export const signupSchema = z.object({
  email:       z.email(),
  password:    z.string().min(8).max(128),
  displayName: safeShortText(30, 2),
}).strict()

export const loginSchema = z.object({
  email:    z.email(),
  password: z.string().min(1),
}).strict()

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
}).strict()

// `cancellationToken` is the server-issued one-time secret returned with
// `userId` on a successful /signup. Both fields are required to cancel an
// in-flight signup so a leaked userId alone can't DoS the registration.
export const cancelSignupSchema = z.object({
  userId:            z.string().uuid(),
  cancellationToken: z.string().uuid(),
}).strict()

export const verifyOtpSchema = z.object({
  email: z.email(),
  token: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be digits only'),
}).strict()

export const resendOtpSchema = z.object({
  email: z.email(),
}).strict()

// Step-up auth on sensitive actions. The current password gates a stolen
// access token from escalating to permanent account takeover.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8).max(128),
}).strict()

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
}).strict()

export type SignupInput         = z.infer<typeof signupSchema>
export type LoginInput          = z.infer<typeof loginSchema>
export type RefreshInput        = z.infer<typeof refreshSchema>
export type CancelSignupInput   = z.infer<typeof cancelSignupSchema>
export type VerifyOtpInput      = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput      = z.infer<typeof resendOtpSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type DeleteAccountInput  = z.infer<typeof deleteAccountSchema>

