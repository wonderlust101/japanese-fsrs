'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'

import { Button }         from '@/components/ui/Button'
import { CapsLockHint }   from '@/components/ui/CapsLockHint'
import { Card }           from '@/components/ui/Card'
import { Input }          from '@/components/ui/Input'
import { Logo }           from '@/components/ui/Logo'
import { ArrowGlyph }     from '@/components/icons/arrow-glyph'
import { loginAction }    from '@/lib/actions/auth.actions'
import { EASE_OUT_EXPO, FadeUpChild, fadeUpStaggerTightVariants, fadeUpVariants, staggerVariants, useStaggerEntrance } from '@/lib/motion'

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

function getJapaneseGreeting(hour: number): string {
  if (hour >= 5  && hour < 11) return 'おはよう'
  if (hour >= 11 && hour < 17) return 'こんにちは'
  if (hour >= 17 && hour < 22) return 'こんばんは'
  return 'おかえり'
}

export default function LoginPage(): React.JSX.Element {
  const router                                          = useRouter()
  const reducedMotion                                   = useReducedMotion()
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
    router.prefetch('/dashboard')
  }, [router])

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => loginAction(email, password),
    onSuccess:  () => {
      router.push('/dashboard')
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

  const { initial, animate } = useStaggerEntrance()

  return (
    <Card variant="default">
      <motion.div
        initial={initial}
        animate={animate}
        variants={staggerVariants}
        className="flex flex-col gap-8"
      >
        <motion.header variants={fadeUpVariants} className="flex flex-col gap-3">
          <Logo size={48} wordmarkSize="md" />
          <p
            lang="ja"
            className="font-japanese text-sm text-faded-sumi min-h-5 mt-2"
            aria-hidden="true"
          >
            {japaneseGreeting !== null && (
              <motion.span
                initial={reducedMotion === true ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reducedMotion === true
                    ? { duration: 0 }
                    : { duration: 0.42, delay: 0.20, ease: EASE_OUT_EXPO }
                }
                className="inline-block"
              >
                {japaneseGreeting}
              </motion.span>
            )}
          </p>
          <h1 className="font-display text-3xl font-bold text-sumi-ink leading-[1.1]">
            <span className="block">Welcome back.</span>
            <span className="block">Ready to practice?</span>
          </h1>
        </motion.header>

        <motion.form variants={fadeUpStaggerTightVariants} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <FadeUpChild>
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
          </FadeUpChild>

          <FadeUpChild className="flex flex-col gap-1.5">
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
          </FadeUpChild>

          <FadeUpChild className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Forgot password?
            </Link>
          </FadeUpChild>

          {formError !== null && (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          )}

          <FadeUpChild>
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
          </FadeUpChild>
        </motion.form>

        <motion.div variants={fadeUpVariants} className="pt-2 border-t border-soft-hairline flex flex-col gap-2">
          <p className="text-base text-faded-sumi">
            No account yet?{' '}
            <Link
              href="/signup"
              className="text-sumi-ink font-medium underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px] transition-colors duration-150"
            >
              Sign up
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
        </motion.div>
      </motion.div>
    </Card>
  )
}
