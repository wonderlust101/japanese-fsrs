'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { Button }       from '@/components/ui/Button'
import { CapsLockHint } from '@/components/ui/CapsLockHint'
import { Card }         from '@/components/ui/Card'
import { CardStack }    from '@/components/ui/CardStack'
import { Input }        from '@/components/ui/Input'
import { Logo }         from '@/components/ui/Logo'
import { OTPInput }     from '@/components/ui/OtpInput'
import { ArrowGlyph }   from '@/components/icons/arrow-glyph'
import { useCountdown } from '@/hooks/use-countdown'
import { verifyOtpAction, resendOtpAction } from '@/lib/actions/auth.actions'
import { env } from '@/lib/env'
import { useUserStore } from '@/stores/user.store'
import { signupSchema } from '@fsrs-japanese/shared-types'

const OTP_RESEND_COOLDOWN = 60

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FRIENDLY_SIGNUP_ERRORS: Record<string, string> = {
  'Too many requests': "Lots of attempts in a row. Take a moment, then come back.",
}

function friendlySignupError(message: string): string {
  return FRIENDLY_SIGNUP_ERRORS[message] ?? "Couldn't create your account. Let's try that again."
}

function friendlyOtpError(message: string): string {
  if (message.toLowerCase().includes('expired'))
    return 'That code has expired. Request a new one below.'
  if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('token'))
    return "That code didn't match. Check your email and try again."
  return "Verification didn't work. Let's try again."
}

// ── View state ───────────────────────────────────────────────────────────

type SignupViewState =
  | { view: 'signup' }
  | { view: 'verify'; userId: string | null; cancellationToken: string | null }

// ── Page ─────────────────────────────────────────────────────────────────

export default function SignupPage(): React.JSX.Element {
  const [viewState, setViewState] = useState<SignupViewState>({ view: 'signup' })
  const [email, setEmail]         = useState('')
  // Inner-CardStack direction (form ↔ verify). Forward when entering verify,
  // backward when going back to the form. The auth route layout owns its own
  // outer CardStack for /login ↔ /signup transitions; the two layers fire on
  // independent keys and don't conflict.
  const direction: 'forward' | 'backward' = viewState.view === 'verify' ? 'forward' : 'backward'

  function handleSuccess(newUserId: string | null, cancellationToken: string | null): void {
    setViewState({ view: 'verify', userId: newUserId, cancellationToken })
  }

  function handleBack(): void {
    if (viewState.view === 'verify' && viewState.userId !== null && viewState.cancellationToken !== null) {
      // Both fields are required server-side: a leaked userId alone cannot DoS
      // an in-flight signup.
      fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/cancel-signup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId:            viewState.userId,
          cancellationToken: viewState.cancellationToken,
        }),
      }).catch(() => {})
    }
    setViewState({ view: 'signup' })
  }

  return (
    <CardStack contentKey={viewState.view} cardsBehind={0} direction={direction}>
      {viewState.view === 'signup' ? (
        <SignupFormView
          email={email}
          onEmailChange={setEmail}
          onSuccess={handleSuccess}
        />
      ) : (
        <VerifyFormView email={email} onBack={handleBack} />
      )}
    </CardStack>
  )
}

// ── Signup form view ─────────────────────────────────────────────────────

interface SignupFormViewProps {
  email:         string
  onEmailChange: (email: string) => void
  onSuccess:     (userId: string | null, cancellationToken: string | null) => void
}

function SignupFormView({ email, onEmailChange, onSuccess }: SignupFormViewProps): React.JSX.Element {
  const [displayName, setDisplayName]         = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [capsLockOn, setCapsLockOn]           = useState(false)
  const [errors, setErrors]                   = useState<{
    email:           string | undefined
    displayName:     string | undefined
    password:        string | undefined
    confirmPassword: string | undefined
    form:            string | undefined
  }>({
    email: undefined, displayName: undefined, password: undefined,
    confirmPassword: undefined, form: undefined,
  })

  const signupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/signup`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email,
            password,
            displayName: displayName.trim(),
          }),
        },
      )
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Signup failed')
      }
      return await res.json() as { userId: string | null; cancellationToken: string | null }
    },
    onSuccess: (body) => {
      onSuccess(body.userId, body.cancellationToken)
    },
    onError: (err) => {
      setErrors((prev) => ({ ...prev, form: friendlySignupError(err.message) }))
    },
  })

  function validate(): boolean {
    const next: typeof errors = {
      email: undefined, displayName: undefined, password: undefined,
      confirmPassword: undefined, form: undefined,
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'That email address looks off. Check the spelling and try again.'
    }
    const result = signupSchema.safeParse({
      email,
      password,
      displayName: displayName.trim(),
    })
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0]
        if (key === 'email'       && next.email       === undefined) next.email       = issue.message
        if (key === 'password'    && next.password    === undefined) next.password    = issue.message
        if (key === 'displayName' && next.displayName === undefined) next.displayName = issue.message
      }
    }
    if (confirmPassword.length === 0) {
      next.confirmPassword = 'Please confirm your password.'
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }
    setErrors(next)
    return Object.values(next).every((v) => v === undefined)
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!validate()) return
    setErrors((prev) => ({ ...prev, form: undefined }))
    signupMutation.mutate()
  }

  function handlePasswordKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }


  return (
    <Card variant="default">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <h1 className="font-display text-3xl font-bold text-sumi-ink leading-[1.1] mt-2">
            Create your account.
          </h1>
          <p className="text-base text-faded-sumi leading-relaxed">
            A few questions, then your first cards.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                onEmailChange(e.target.value)
                if (errors.email !== undefined) setErrors((prev) => ({ ...prev, email: undefined }))
              }}
              required
              placeholder="you@example.com"
              error={errors.email}
            />
          </div>

          <div>
            <Input
              label="Display name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                if (errors.displayName !== undefined) setErrors((prev) => ({ ...prev, displayName: undefined }))
              }}
              required
              placeholder="Your name"
              hint="How you'd like to be addressed"
              error={errors.displayName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password !== undefined) setErrors((prev) => ({ ...prev, password: undefined }))
              }}
              onKeyDown={handlePasswordKey}
              onKeyUp={handlePasswordKey}
              required
              placeholder="••••••••"
              hint="At least 8 characters"
              error={errors.password}
            />
            {capsLockOn && <CapsLockHint />}
          </div>

          <div>
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword !== undefined) setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
              }}
              required
              placeholder="••••••••"
              error={errors.confirmPassword}
            />
          </div>

          {errors.form !== undefined && (
            <p role="alert" className="text-sm text-error">
              {errors.form}
            </p>
          )}

          <div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={signupMutation.isPending}
              trailingIcon={<ArrowGlyph direction="right" />}
              className="w-full mt-2"
            >
              Create account
            </Button>
          </div>
        </form>

        <div className="pt-2 border-t border-soft-hairline flex flex-col gap-2">
          <p className="text-base text-faded-sumi">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>
          <p className="text-sm text-faded-sumi">
            Need help?{' '}
            <Link
              href="/help"
              className="text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Get help
            </Link>
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── OTP verify form view ─────────────────────────────────────────────────

function VerifyFormView({ email, onBack }: { email: string; onBack: () => void }): React.JSX.Element {
  const router                                 = useRouter()
  const [otpError, setOtpError]                = useState<string | null>(null)
  const [otpErrorVersion, setOtpErrorVersion]  = useState(0)
  const [resendMsg, setResendMsg]              = useState<string | null>(null)
  const { remaining, restart }                 = useCountdown(OTP_RESEND_COOLDOWN)

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => verifyOtpAction(email, otp),
    onSuccess:  () => {
      useUserStore.getState().actions.reset()
      router.push('/onboarding/level')
      router.refresh()
    },
    onError: (err) => {
      setOtpError(friendlyOtpError(err.message))
      setOtpErrorVersion((v) => v + 1)
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => resendOtpAction(email),
    onSuccess:  () => {
      setResendMsg('A new code has been sent.')
      restart()
    },
    onError: () => {
      setResendMsg("Couldn't resend the code. Please try again.")
    },
  })

  function handleOtpComplete(otp: string): void {
    setOtpError(null)
    verifyMutation.mutate(otp)
  }

  function handleResend(): void {
    if (remaining > 0) return
    setResendMsg(null)
    resendMutation.mutate()
  }


  return (
    <Card variant="default">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <h1 className="font-display text-3xl font-bold text-sumi-ink leading-[1.1] mt-2">
            Quick check.
          </h1>
          <p className="text-base text-faded-sumi leading-relaxed">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-sumi-ink break-all">{email}</span>.
            It expires in 1 minute.
          </p>
        </header>

        <div className="flex flex-col items-center gap-6">
          <div>
            <OTPInput
              key={otpErrorVersion}
              onComplete={handleOtpComplete}
              error={otpError}
              isLoading={verifyMutation.isPending}
            />
          </div>

          {otpError !== null && (
            <p role="alert" className="text-sm text-error text-center">
              {otpError}
            </p>
          )}

          <div className="text-center text-sm text-faded-sumi">
            {remaining > 0 ? (
              <span>Resend in {remaining}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendMutation.isPending}
                className="text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
              >
                Resend code
              </button>
            )}
          </div>

          {resendMsg !== null && (
            <p
              role="status"
              className={[
                'text-sm text-center',
                resendMsg.startsWith("Couldn't") ? 'text-error' : 'text-faded-sumi',
              ].join(' ')}
            >
              {resendMsg}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-soft-hairline">
          <p className="text-base text-faded-sumi text-center">
            Wrong email?{' '}
            <button
              type="button"
              onClick={onBack}
              className="text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Go back
            </button>
          </p>
        </div>
      </div>
    </Card>
  )
}
