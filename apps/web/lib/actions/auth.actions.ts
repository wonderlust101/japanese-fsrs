'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
  expiresIn:    number
}

export async function loginAction(email: string, password: string): Promise<AuthTokens> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error !== null || data.session === null) {
    throw new Error(error?.message ?? 'Invalid email or password')
  }

  return {
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn:    data.session.expires_in,
  }
}

export async function verifyOtpAction(email: string, token: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })

  if (error !== null) {
    throw new Error(error.message)
  }
}

export async function resendOtpAction(email: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })

  if (error !== null) {
    throw new Error(error.message ?? 'Failed to resend code')
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
}
