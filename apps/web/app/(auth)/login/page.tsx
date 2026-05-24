'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { Button }            from '@/components/ui/Button'
import { CapsLockHint }      from '@/components/ui/CapsLockHint'
import { Card }              from '@/components/ui/Card'
import { Input }             from '@/components/ui/Input'
import { Logo }              from '@/components/ui/Logo'
import { ArrowGlyph }        from '@/components/icons/arrow-glyph'
import { loginAction }       from '@/lib/actions/auth.actions'
import { getJapaneseGreeting } from '@/lib/japanese-greeting'
import { useLoginDevState }  from '@/dev/panels/auth-login'

const FRIENDLY_ERRORS: Record<string, string> = {
  'Invalid login credentials': "That didn't match. Try again, or reset your password.",
  'Too many requests':         "Lots of attempts in a row. Take a moment, then come back.",
  'Email not confirmed':       "Check your email for a confirmation link first.",
  'Network request failed':    "Looks like a connection hiccup. Check your internet and try again.",
}

function friendlyError(message: string): string {
  return FRIENDLY_ERRORS[message] ?? "Couldn't sign in. Let's try that again."
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns `raw` only if it's an app-internal path (single leading slash, not a
 * protocol-relative `//host` or absolute URL). Guards the post-login redirect
 * against open-redirect via a crafted `?next=`.
 */
function safeNextPath(raw: string | null): string | null {
  if (raw === null || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export default function LoginPage(): React.JSX.Element {
  useLoginDevState()
  const router                                          = useRouter()
  const [email, setEmail]                               = useState('')
  const [password, setPassword]                         = useState('')
  const [emailError, setEmailError]                     = useState<string | undefined>(undefined)
  const [clientPasswordError, setClientPasswordError]   = useState<string | undefined>(undefined)
  const [capsLockOn, setCapsLockOn]                     = useState(false)
  const [japaneseGreeting, setJapaneseGreeting]         = useState<string | null>(null)

  useEffect(() => {
    setJapaneseGreeting(getJapaneseGreeting(new Date().getHours()))
  }, [])

  useEffect(() => {
    router.prefetch('/today')
  }, [router])

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => loginAction(email, password),
    onSuccess:  () => {
      // Return to the page the user was sent here from (middleware sets `next`);
      // fall back to /today. Read at event time to avoid a useSearchParams
      // Suspense boundary; validated against open-redirect.
      const next = safeNextPath(new URLSearchParams(window.location.search).get('next'))
      router.push(next ?? '/today')
      router.refresh()
    },
  })

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError('That email address looks off. Check the spelling and try again.')
      return
    }
    setEmailError(undefined)
    if (password.length === 0) {
      setClientPasswordError('Please enter your password.')
      return
    }
    setClientPasswordError(undefined)
    mutate()
  }

  function handlePasswordKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }

  const isCredsError    = error !== null && error.message === 'Invalid login credentials'
  const apiPasswordError = isCredsError ? friendlyError(error.message) : undefined
  const passwordError   = clientPasswordError ?? apiPasswordError
  const formError       = error !== null && !isCredsError ? friendlyError(error.message) : null


  return (
    <Card variant="default">
      <div        className="flex flex-col gap-8"
      >
        <header className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <p
            lang="ja"
            className="font-japanese text-sm text-faded-sumi min-h-5 mt-2"
            aria-hidden="true"
          >
            {japaneseGreeting !== null && (
              <span                className="inline-block"
              >
                {japaneseGreeting}
              </span>
            )}
          </p>
          <h1 className="font-display text-3xl font-medium text-sumi-ink leading-[1.1]">
            <span className="block">Welcome back.</span>
            <span className="block">Ready to practice?</span>
          </h1>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError !== undefined) setEmailError(undefined)
            }}
            required
            placeholder="you@example.com"
            error={emailError}
          />

          <div className="flex flex-col gap-2">
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (clientPasswordError !== undefined) setClientPasswordError(undefined)
              }}
              onKeyDown={handlePasswordKey}
              onKeyUp={handlePasswordKey}
              required
              placeholder="••••••••"
              error={passwordError}
            />
            {capsLockOn && <CapsLockHint />}
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Forgot password?
            </Link>
          </div>

          {formError !== null && (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isPending}
            trailingIcon={<ArrowGlyph direction="right" />}
            className="w-full mt-2"
          >
            Sign in
          </Button>
        </form>

        <div className="pt-2 border-t border-soft-hairline flex flex-col gap-2">
          <p className="text-base text-faded-sumi">
            No account yet?{' '}
            <Link
              href="/signup"
              className="text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </Card>
  )
}
