'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { CardStack } from '@/components/ui/CardStack'

// /login is index 0, /signup (and /signup/verify) is index 1. login → signup
// reads as forward (deeper into onboarding), signup → login as backward.
function authRouteIndex(pathname: string): number {
  if (pathname.startsWith('/signup')) return 1
  return 0
}

/**
 * Persistent auth-route shell.
 *
 * Owns the centered page chrome (max-width 480px, cool-paper background) and
 * a single CardStack that animates the page-turn between /login and /signup.
 * Each page renders its own <Card> inside; signup additionally nests its own
 * CardStack for the form ↔ verify view-state transition. The two layers
 * fire on different keys (pathname for the outer, viewState for the inner)
 * so they don't conflict.
 */
export function AuthShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()
  const idx      = authRouteIndex(pathname)

  // Track prior route index for direction-aware transitions. Read-then-update
  // via effect to keep the render body pure (mutating refs during render
  // misbehaves under concurrent rendering and StrictMode).
  const prevRef = useRef<number>(idx)
  const direction: 'forward' | 'backward' =
    idx >= prevRef.current ? 'forward' : 'backward'
  useEffect(() => {
    prevRef.current = idx
  }, [idx])

  return (
    <main className="min-h-screen flex items-center justify-center bg-cool-paper-base px-6 py-12">
      <div className="w-full max-w-[480px]">
        <CardStack contentKey={pathname} cardsBehind={0} direction={direction}>
          {children}
        </CardStack>
      </div>
    </main>
  )
}
