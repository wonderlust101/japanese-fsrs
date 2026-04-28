'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginAction } from '@/lib/actions/auth.actions'

const FRIENDLY_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Too many requests':         'Too many attempts. Please wait a moment and try again.',
}

function friendlyError(message: string): string {
  return FRIENDLY_ERRORS[message] ?? 'Something went wrong. Please try again.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => loginAction(email, password),
    onSuccess: () => {
      router.push('/dashboard')
      router.refresh()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate()
  }

  const errorMessage = error ? friendlyError((error as Error).message) : null

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900 mb-6">Sign in</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
        />

        {errorMessage && (
          <p role="alert" className="text-xs text-danger-500">
            {errorMessage}
          </p>
        )}

        <Button type="submit" variant="primary" size="md" loading={isPending} className="w-full mt-2">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary-600 font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </>
  )
}
