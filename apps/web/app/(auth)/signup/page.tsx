'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OTPInput } from '@/components/ui/otp-input'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { useUserStore } from '@/stores/user.store'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'

// ── Constants ─────────────────────────────────────────────────────────────────

const OTP_RESEND_COOLDOWN = 60 // seconds

// Maps backend error messages to user-friendly strings.
const SIGNUP_ERRORS: Record<string, string> = {
  'Email address already registered': 'An account with this email already exists.',
  'User already registered':          'An account with this email already exists.',
  'Too many requests':                'Too many attempts. Please wait a moment and try again.',
}

function friendlySignupError(message: string): string {
  return SIGNUP_ERRORS[message] ?? message
}

function friendlyOtpError(message: string): string {
  if (message.toLowerCase().includes('expired'))
    return 'That code has expired. Request a new one below.'
  if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('token'))
    return 'Invalid code. Check your email and try again.'
  return 'Verification failed. Please try again.'
}

// ── View type ─────────────────────────────────────────────────────────────────

type View = 'signup' | 'verify'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const [view, setView]   = useState<View>('signup')
  const [email, setEmail] = useState('')

  if (view === 'verify') {
    return <VerifyView email={email} onBack={() => setView('signup')} />
  }

  return (
    <SignupForm
      email={email}
      onEmailChange={setEmail}
      onSuccess={() => setView('verify')}
    />
  )
}

// ── Signup form view ──────────────────────────────────────────────────────────

interface SignupFormProps {
  email:         string
  onEmailChange: (email: string) => void
  onSuccess:     () => void
}

function SignupForm({ email, onEmailChange, onSuccess }: SignupFormProps) {
  const [username, setUsername]               = useState('')
  const [usernameStatus, setUsernameStatus]   = useState<UsernameStatus>('idle')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors]                   = useState<{
    username?:        string
    email?:           string
    password?:        string
    confirmPassword?: string
    form?:            string
  }>({})
  const [loading, setLoading] = useState(false)

  // Debounced username availability check.
  useEffect(() => {
    setUsernameStatus('idle')
    const trimmed = username.trim()
    if (trimmed.length < 3 || trimmed.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setUsernameStatus('checking')
      try {
        const res = await fetch(
          `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/check-username?username=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        if (!res.ok || controller.signal.aborted) return
        const body = await res.json() as { available: boolean }
        setUsernameStatus(body.available ? 'available' : 'taken')
      } catch {
        if (!controller.signal.aborted) setUsernameStatus('idle')
      }
    }, 500)

    return () => { clearTimeout(timer); controller.abort() }
  }, [username])

  function validate(): boolean {
    const next: typeof errors = {}

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      next.username = 'Username is required.'
    } else if (trimmedUsername.length < 3) {
      next.username = 'Username must be at least 3 characters.'
    } else if (trimmedUsername.length > 20) {
      next.username = 'Username must be at most 20 characters.'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      next.username = 'Letters, numbers, _ and - only.'
    } else if (usernameStatus === 'taken') {
      next.username = 'Username is already taken.'
    } else if (usernameStatus === 'checking') {
      next.username = 'Please wait while we check availability.'
    }

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
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/signup`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password, username: username.trim() }),
        },
      )

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        const msg  = body.error ?? 'Signup failed'
        if (msg.toLowerCase().includes('username')) {
          setErrors({ username: msg })
          setUsernameStatus('taken')
        } else {
          setErrors({ form: friendlySignupError(msg) })
        }
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' })
      setLoading(false)
    }
  }

  const usernameHint =
    usernameStatus === 'checking'  ? 'Checking availability…' :
    usernameStatus === 'available' ? '✓ Available' :
    '3–20 characters, letters, numbers, _ or -'

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900 mb-6">Create account</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          placeholder="you@example.com"
          error={errors.email}
        />

        <Input
          label="Username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="your_username"
          hint={usernameHint}
          error={errors.username ?? (usernameStatus === 'taken' && !errors.username ? 'Username is already taken.' : undefined)}
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

// ── OTP verification view ─────────────────────────────────────────────────────

function VerifyView({ email, onBack }: { email: string; onBack: () => void }) {
  const router         = useRouter()
  const [otpError, setOtpError]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [cooldown, setCooldown]   = useState(OTP_RESEND_COOLDOWN)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const cooldownRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the resend cooldown timer on mount.
  useEffect(() => {
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [])

  async function handleOtpComplete(otp: string) {
    // Reset error before the attempt so the shake can re-trigger if this
    // attempt also fails.
    setOtpError(null)
    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type:  'signup',
    })

    if (error) {
      setOtpError(friendlyOtpError(error.message))
      setLoading(false)
      return
    }

    // OTP accepted — Supabase has established the session via SSR cookies.
    // Clear any stale profile from a previous user before entering onboarding.
    useUserStore.getState().actions.reset()
    router.push('/onboarding/level')
    router.refresh()
  }

  async function handleResend() {
    if (cooldown > 0) return
    setResendMsg(null)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })

    if (error) {
      setResendMsg('Could not resend the code. Please try again.')
      return
    }

    setResendMsg('A new code has been sent.')
    setCooldown(OTP_RESEND_COOLDOWN)

    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  return (
    // The `animate-page-enter` class re-triggers the CSS enter animation so
    // the verify view slides in from below, matching the onboarding step
    // transitions. This runs once on mount — no ongoing animation overhead.
    <div className="animate-page-enter">
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">
        Check your email
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        We sent a 6-digit code to{' '}
        <span className="font-medium text-neutral-700">{email}</span>.
        It expires in 10 minutes.
      </p>

      <div className="flex flex-col items-center gap-6">
        <OTPInput
          onComplete={handleOtpComplete}
          error={otpError}
          isLoading={loading}
        />

        {otpError && (
          <p role="alert" className="text-xs text-danger-500 text-center">
            {otpError}
          </p>
        )}

        <div className="text-center text-sm text-neutral-500">
          {cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-primary-600 font-medium hover:underline focus:outline-none
                         focus-visible:ring-[3px] focus-visible:ring-primary-200 rounded"
            >
              Resend code
            </button>
          )}
        </div>

        {resendMsg && (
          <p
            role="status"
            className={[
              'text-xs text-center',
              resendMsg.startsWith('Could') ? 'text-danger-500' : 'text-success-700',
            ].join(' ')}
          >
            {resendMsg}
          </p>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Wrong email?{' '}
        <button
          type="button"
          onClick={onBack}
          className="text-primary-600 font-medium hover:underline focus:outline-none
                     focus-visible:ring-[3px] focus-visible:ring-primary-200 rounded"
        >
          Go back
        </button>
      </p>
    </div>
  )
}
