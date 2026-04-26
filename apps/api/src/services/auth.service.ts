import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import type { SignupInput, LoginInput, RefreshInput } from '../schemas/auth.schema.ts'

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
  expiresIn:    number
}

export interface SignupResult {
  userId: string
  email:  string
}

export async function signup(input: SignupInput): Promise<SignupResult> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email:             input.email,
    password:          input.password,
    email_confirm:     true,
  })

  if (error !== null || data.user === null) {
    throw new AppError(409, error?.message ?? 'Signup failed')
  }

  return { userId: data.user.id, email: data.user.email ?? input.email }
}

export async function login(input: LoginInput): Promise<AuthTokens> {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email:    input.email,
    password: input.password,
  })

  if (error !== null || data.session === null) {
    throw new AppError(401, 'Invalid email or password')
  }

  return {
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn:    data.session.expires_in,
  }
}

export async function refresh(input: RefreshInput): Promise<AuthTokens> {
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: input.refreshToken,
  })

  if (error !== null || data.session === null) {
    throw new AppError(401, 'Invalid or expired refresh token')
  }

  return {
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn:    data.session.expires_in,
  }
}

export async function logout(jwt: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(jwt)

  if (error !== null) {
    throw new AppError(500, 'Logout failed')
  }
}
