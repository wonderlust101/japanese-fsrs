'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OTPInput } from '@/components/ui/OtpInput'
import { useCountdown } from '@/hooks/use-countdown'
import { verifyOtpAction, resendOtpAction } from '@/lib/actions/auth.actions'
import { env } from '@/lib/env'
import { useUserStore } from '@/stores/user.store'
import { signupSchema } from '@fsrs-japanese/shared-types'

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

// ── View state ────────────────────────────────────────────────────────────────
// Discriminated union: 'verify' is reachable only after a successful signup
// returns a userId. The type makes it impossible to land in the verify view
// without the userId needed to cancel the pending account.

type SignupViewState =
  | { view: 'signup' }
  | { view: 'verify'; userId: string }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignupPage(): React.JSX.Element {
  const [viewState, setViewState] = useState<SignupViewState>({ view: 'signup' })
  const [email,     setEmail]     = useState('')

  function handleSuccess(newUserId: string) {
    setViewState({ view: 'verify', userId: newUserId })
  }

  function handleBack() {
    if (viewState.view === 'verify') {
      fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/cancel-signup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: viewState.userId }),
      }).catch(() => {})
    }
    setViewState({ view: 'signup' })
  }

  switch (viewState.view) {
    case 'verify':
      return <VerifyView email={email} onBack={handleBack} />
    case 'signup':
      return (
        <SignupForm
          email={email}
          onEmailChange={setEmail}
          onSuccess={handleSuccess}
        />
      )
    default: {
      const _exhaustiveCheck: never = viewState
      throw new Error(`Unhandled signup view state: ${JSON.stringify(_exhaustiveCheck)}`)
    }
  }
}

// ── Signup form view ──────────────────────────────────────────────────────────

interface SignupFormProps {
  email:         string
  onEmailChange: (email: string) => void
  onSuccess:     (userId: string) => void
}

function SignupForm({ email, onEmailChange, onSuccess }: SignupFormProps) {
  const [displayName, setDisplayName]         = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors]                   = useState<{
    display_name?:    string
    email?:           string
    password?:        string
    confirmPassword?: string
    form?:            string
  }>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}

    // Schema-driven field validation: matches the server signupSchema exactly.
    // Cross-field rules (confirmPassword) live below since they're not part of
    // the API contract.
    const result = signupSchema.safeParse({
      email,
      password,
      display_name: displayName.trim(),
    })
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0]
        if (key === 'email')        next.email        ??= issue.message
        if (key === 'password')     next.password     ??= issue.message
        if (key === 'display_name') next.display_name ??= issue.message
      }
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
        `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/signup`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password, display_name: displayName.trim() }),
        },
      )

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setErrors({ form: friendlySignupError(body.error ?? 'Signup failed') })
        setLoading(false)
        return
      }

      const body = await res.json() as { userId: string }
      onSuccess(body.userId)
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
          onChange={(e) => onEmailChange(e.target.value)}
          required
          placeholder="you@example.com"
          error={errors.email}
        />

        <Input
          label="Display name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="Your Name"
          hint="How you'll appear to yourself in the app"
          error={errors.display_name}
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
  const router = useRouter()
  const [otpError, setOtpError]           = useState<string | null>(null)
  const [otpErrorVersion, setOtpErrorVersion] = useState(0)
  const [resendMsg, setResendMsg]         = useState<string | null>(null)
  const { remaining, restart }            = useCountdown(OTP_RESEND_COOLDOWN)

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => verifyOtpAction(email, otp),
    onSuccess: () => {
      useUserStore.getState().actions.reset()
      router.push('/onboarding/level')
      router.refresh()
    },
    onError: (err) => {
      setOtpError(friendlyOtpError(err.message))
      // Incrementing the version remounts OTPInput, clearing digits and
      // restarting the shake animation without any useEffect in the child.
      setOtpErrorVersion((v) => v + 1)
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => resendOtpAction(email),
    onSuccess: () => {
      setResendMsg('A new code has been sent.')
      restart()
    },
    onError: () => {
      setResendMsg('Could not resend the code. Please try again.')
    },
  })

  function handleOtpComplete(otp: string) {
    setOtpError(null)
    verifyMutation.mutate(otp)
  }

  function handleResend() {
    if (remaining > 0) return
    setResendMsg(null)
    resendMutation.mutate()
  }

  return (
    <div className="animate-page-enter">
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">
        Check your email
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        We sent a 6-digit code to{' '}
        <span className="font-medium text-neutral-700">{email}</span>.
        It expires in 1 minute.
      </p>

      <div className="flex flex-col items-center gap-6">
        <OTPInput
          key={otpErrorVersion}
          onComplete={handleOtpComplete}
          error={otpError}
          isLoading={verifyMutation.isPending}
        />

        {otpError && (
          <p role="alert" className="text-xs text-danger-500 text-center">
            {otpError}
          </p>
        )}

        <div className="text-center text-sm text-neutral-500">
          {remaining > 0 ? (
            <span>Resend in {remaining}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendMutation.isPending}
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
