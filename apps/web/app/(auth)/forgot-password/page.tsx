'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
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
import {
  requestPasswordResetAction,
  verifyRecoveryOtpAction,
  updatePasswordAction,
} from '@/lib/actions/auth.actions'
import { passwordSchema } from '@fsrs-japanese/shared-types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Below the recovery code's ~60s lifetime so resend unlocks while the current
// code is still usable. Mirrors the signup OTP cooldown.
const RESET_RESEND_COOLDOWN = 30

function friendlyOtpError(message: string): string {
  if (message.toLowerCase().includes('expired'))
    return 'That code has expired. Request a new one below.'
  if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('token'))
    return "That code didn't match. Check your email and try again."
  return "Verification didn't work. Let's try again."
}

// ── View state ─────────────────────────────────────────────────────────────
// request → verify → reset, each one step "deeper". The index drives the
// card-turn direction (forward on advance, backward on going back).
type ResetView = 'request' | 'verify' | 'reset'
const VIEW_INDEX: Record<ResetView, number> = { request: 0, verify: 1, reset: 2 }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage(): React.JSX.Element {
  const [view, setView]   = useState<ResetView>('request')
  const [email, setEmail] = useState('')

  const prevIdxRef = useRef(VIEW_INDEX.request)
  const idx        = VIEW_INDEX[view]
  const direction: 'forward' | 'backward' = idx >= prevIdxRef.current ? 'forward' : 'backward'

  // Mirror the signup verify-swap choreography: on each view change the card
  // turns in from the side the navigation came from, and the rows cascade.
  // Honors prefers-reduced-motion. The outer AuthShell only animates on route
  // change, which this single-route flow never triggers, so the swap is owned
  // here.
  const innerRef    = useRef<HTMLDivElement>(null)
  const firstRunRef = useRef(true)
  useEffect(() => {
    const prevIdx = prevIdxRef.current
    prevIdxRef.current = idx
    if (firstRunRef.current) { firstRunRef.current = false; return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (innerRef.current === null) return

    const card    = innerRef.current.querySelector<HTMLElement>('[data-auth-card]')
    const content = card?.querySelector(':scope > div')
    const rows    = content ? Array.from(content.children) : []
    if (card === null || card === undefined) return

    const dirX = idx >= prevIdx ? 34 : -34
    gsap.set(card, { opacity: 0, y: 20, x: dirX })
    if (rows.length > 0) gsap.set(rows, { opacity: 0, y: 12 })

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.to(card, { opacity: 1, y: 0, x: 0, duration: 0.55 })
    if (rows.length > 0) {
      tl.to(rows, { opacity: 1, y: 0, duration: 0.42, stagger: 0.07, ease: 'power2.out' }, '-=0.28')
    }

    return () => {
      tl.kill()
      gsap.set([card, ...rows], { clearProps: 'opacity,transform' })
    }
  }, [view, idx])

  return (
    <div ref={innerRef}>
      <CardStack contentKey={view} cardsBehind={0} direction={direction}>
        {view === 'request' ? (
          <RequestView
            email={email}
            onEmailChange={setEmail}
            onSent={() => setView('verify')}
          />
        ) : view === 'verify' ? (
          <VerifyView
            email={email}
            onVerified={() => setView('reset')}
            onBack={() => setView('request')}
          />
        ) : (
          <ResetView />
        )}
      </CardStack>
    </div>
  )
}

// ── Request view ───────────────────────────────────────────────────────────

interface RequestViewProps {
  email:         string
  onEmailChange: (email: string) => void
  onSent:        () => void
}

function RequestView({ email, onEmailChange, onSent }: RequestViewProps): React.JSX.Element {
  const [emailError, setEmailError] = useState<string | undefined>(undefined)

  const { mutate, isPending } = useMutation({
    mutationFn: () => requestPasswordResetAction(email),
    // Resolves whether or not the email exists; always advance to code entry.
    onSuccess:  () => onSent(),
  })

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError('That email address looks off. Check the spelling and try again.')
      return
    }
    setEmailError(undefined)
    mutate()
  }

  return (
    <Card variant="default" data-auth-card>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <h1 className="font-display text-3xl font-semibold text-sumi-ink leading-[1.1] mt-2">
            Reset your password.
          </h1>
          <p className="text-base text-faded-sumi leading-relaxed">
            Enter your email and we&rsquo;ll send a 6-digit code to set a new one.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            size="lg"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              onEmailChange(e.target.value)
              if (emailError !== undefined) setEmailError(undefined)
            }}
            required
            placeholder="you@example.com"
            error={emailError}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isPending}
            trailingIcon={<ArrowGlyph direction="right" />}
            className="w-full mt-2"
          >
            Send reset code
          </Button>
        </form>

        <div className="pt-2 border-t border-soft-hairline flex flex-col gap-2">
          <p className="text-base text-faded-sumi">
            Remembered it?{' '}
            <Link
              href="/login"
              className="inline-block py-1 text-sumi-ink font-medium underline decoration-faded-sumi decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-xs transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>
          <p className="text-sm text-faded-sumi">
            Need help?{' '}
            <Link
              href="/help"
              className="inline-block py-1 text-sumi-ink font-medium underline decoration-faded-sumi decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-xs transition-colors duration-150"
            >
              Get help
            </Link>
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Verify view (recovery OTP) ───────────────────────────────────────────────

function VerifyView({
  email,
  onVerified,
  onBack,
}: {
  email:      string
  onVerified: () => void
  onBack:     () => void
}): React.JSX.Element {
  const [otpError, setOtpError]               = useState<string | null>(null)
  const [otpErrorVersion, setOtpErrorVersion] = useState(0)
  const [resendMsg, setResendMsg]             = useState<string | null>(null)
  const { remaining, restart }                = useCountdown(RESET_RESEND_COOLDOWN)

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => verifyRecoveryOtpAction(email, otp),
    onSuccess:  () => onVerified(),
    onError:    (err) => {
      setOtpError(friendlyOtpError(err.message))
      setOtpErrorVersion((v) => v + 1)
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => requestPasswordResetAction(email),
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
    <Card variant="default" data-auth-card>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <h1 className="font-display text-3xl font-semibold text-sumi-ink leading-[1.1] mt-2">
            Check your email.
          </h1>
          <p className="text-base text-faded-sumi leading-relaxed">
            If{' '}
            <span className="font-medium text-sumi-ink break-all">{email}</span>{' '}
            is registered, we sent a 6-digit code. It&rsquo;s good for about a minute,
            so enter it soon.
          </p>
        </header>

        <div className="flex flex-col items-center gap-6">
          <OTPInput
            onComplete={handleOtpComplete}
            error={otpError}
            errorId="reset-otp-error"
            errorNonce={otpErrorVersion}
            isLoading={verifyMutation.isPending}
          />

          {otpError !== null && (
            <p id="reset-otp-error" role="alert" className="text-sm text-error text-center">
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
                className="inline-flex items-center min-h-11 text-sumi-ink font-medium underline decoration-faded-sumi decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-xs transition-colors duration-150"
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
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center min-h-11 text-sumi-ink font-medium underline decoration-faded-sumi decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-xs transition-colors duration-150"
            >
              Use a different email
            </button>
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Reset view (new password) ────────────────────────────────────────────────

function ResetView(): React.JSX.Element {
  const router                                = useRouter()
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [capsLockOn, setCapsLockOn]           = useState(false)
  const [errors, setErrors]                   = useState<{
    password:        string | undefined
    confirmPassword: string | undefined
    form:            string | undefined
  }>({ password: undefined, confirmPassword: undefined, form: undefined })

  const updateMutation = useMutation({
    mutationFn: () => updatePasswordAction(password),
    onSuccess:  () => {
      // The recovery verify already established a session, so go straight into
      // the app rather than bouncing back through login.
      router.push('/today')
      router.refresh()
    },
    onError: () => {
      setErrors((prev) => ({ ...prev, form: "Couldn't update your password. Let's try again." }))
    },
  })

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const next = { password: undefined, confirmPassword: undefined, form: undefined } as typeof errors
    if (!passwordSchema.safeParse(password).success) {
      next.password = 'Use at least 8 characters.'
    }
    if (confirmPassword.length === 0) {
      next.confirmPassword = 'Please confirm your password.'
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }
    setErrors(next)
    if (next.password !== undefined || next.confirmPassword !== undefined) return
    updateMutation.mutate()
  }

  function handlePasswordKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }

  return (
    <Card variant="default" data-auth-card>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <h1 className="font-display text-3xl font-semibold text-sumi-ink leading-[1.1] mt-2">
            Choose a new password.
          </h1>
          <p className="text-base text-faded-sumi leading-relaxed">
            Almost done. Pick something you&rsquo;ll remember.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              label="New password"
              type="password"
              size="lg"
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

          <Input
            label="Confirm password"
            type="password"
            size="lg"
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

          {errors.form !== undefined && (
            <p role="alert" className="text-sm text-error">
              {errors.form}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={updateMutation.isPending}
            trailingIcon={<ArrowGlyph direction="right" />}
            className="w-full mt-2"
          >
            Set new password
          </Button>
        </form>
      </div>
    </Card>
  )
}
