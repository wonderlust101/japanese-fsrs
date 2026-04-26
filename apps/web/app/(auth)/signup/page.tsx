'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

// Maps backend error messages (from AppError.message) to user-friendly strings.
// The backend returns the raw Supabase error message for auth failures.
const FRIENDLY_ERRORS: Record<string, string> = {
  'Email address already registered':    'An account with this email already exists.',
  'User already registered':             'An account with this email already exists.',
  'Password should be at least 6 characters': 'Password must be at least 8 characters.',
  'Too many requests':                   'Too many attempts. Please wait a moment and try again.',
}

function friendlyError(message: string): string {
  return FRIENDLY_ERRORS[message] ?? message
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; form?: string }>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}

    if (!email) {
      next.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Please enter a valid email address.'
    }

    if (!password) {
      next.password = 'Password is required.'
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.'
    }

    if (!confirmPassword) {
      next.confirmPassword = 'Please confirm your password.'
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setErrors({})
    setLoading(true)

    try {
      // Step 1: Create the account via the backend.
      // Uses admin.createUser({ email_confirm: true }) so the account is
      // immediately active regardless of the Supabase project's email
      // confirmation setting. Also initialises the profile row.
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/signup`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        },
      )

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setErrors({ form: friendlyError(body.error ?? 'Signup failed') })
        setLoading(false)
        return
      }

      // Step 2: Sign in immediately — the account is already confirmed.
      const supabase = createSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        // Account was created but sign-in failed — send the user to login
        // rather than leaving them in a broken state.
        router.push('/login')
        return
      }

      router.push('/onboarding')
      router.refresh()
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900 mb-6">Create account</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          error={errors.email}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          hint="At least 8 characters"
          error={errors.password}
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="••••••••"
          error={errors.confirmPassword}
        />

        {errors.form && (
          <p role="alert" className="text-xs text-danger-500">
            {errors.form}
          </p>
        )}

        <Button type="submit" variant="primary" size="md" loading={loading} className="w-full mt-2">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
