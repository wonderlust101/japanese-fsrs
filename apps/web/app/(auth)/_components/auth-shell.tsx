'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { CardStack } from '@/components/ui/CardStack'
import { InariBrandPanel } from '@/components/brand/InariBrandPanel'
import { InariEditorialField } from '@/components/brand/InariEditorialField'

// /login is index 0, /signup (and /signup/verify) is index 1. login → signup
// reads as forward (deeper into onboarding), signup → login as backward.
function authRouteIndex(pathname: string): number {
  if (pathname.startsWith('/signup')) return 1
  return 0
}

/**
 * Persistent auth-route shell.
 *
 * Split identity layout: the form rides a card on the cool-paper left column,
 * the drenched Inari brand panel fills the right column at `lg+`. Below `lg`
 * the brand panel drops away and the form goes full-width. The form side is
 * dressed with a static editorial composition (a hand-of-light, an oversized
 * 友 glyph bleeding off the corner, hairline rules, a vignette, and a
 * vermillion seam-wash) so the surface is never blank and reads as continuous
 * with the brand panel. No animation on this side.
 *
 * Choreography (brand register opts up to "Choreographed" per DESIGN.md):
 * on mount and on every /login ↔ /signup change, a GSAP timeline settles the
 * form card in and cascades its rows. The card-turn is direction-aware — it
 * slides in from the right going forward (login → signup) and from the left
 * going back — so the route change reads as turning a card, not a hard cut.
 * Honors `prefers-reduced-motion`: the content simply rests, fully visible.
 */
export function AuthShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()
  const idx      = authRouteIndex(pathname)

  const formColRef = useRef<HTMLDivElement>(null)
  // Prior route index, read inside the animation effect to pick slide direction.
  // First paint uses index 0 so the opening play has no horizontal travel.
  const prevIdxRef = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prev    = prevIdxRef.current
    prevIdxRef.current = idx
    if (reduceMotion || formColRef.current === null) return

    const card    = formColRef.current.querySelector<HTMLElement>('[data-auth-card]')
    const content = card?.querySelector(':scope > div')
    const rows    = content ? Array.from(content.children) : []
    if (card === null || card === undefined) return

    // First mount → gentle rise, no travel. Route change → slide from the side
    // the navigation came from (forward = enter from the right).
    const dirX = prev === null ? 0 : (idx >= prev ? 34 : -34)

    // Explicit set → to (not `from`): a `from` tween records its end-state on
    // creation, which is fragile across client-route re-runs and can leave the
    // card stuck invisible. The cleanup clears props so an interrupted entrance
    // can never strand the card hidden.
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
  }, [pathname, idx])

  return (
    <main className="relative min-h-screen bg-cool-paper-base lg:grid lg:grid-cols-2">
      {/* Static editorial decoration behind the form column (full-bleed on
          mobile, left half on lg where the brand panel owns the right). The
          shared InariEditorialField: a composed ink-on-paper still that also
          backs the onboarding surface, so the signup → onboarding handoff is
          one continuous field. The reading side stays motionless on auth (the
          drenched brand panel beside it is the animated hero). */}
      <InariEditorialField variant="split" />

      {/* Left: the form card. */}
      <div
        ref={formColRef}
        className="relative z-10 flex items-center justify-center px-8 py-14 lg:px-16 lg:py-16"
      >
        <div className="w-full max-w-[520px] lg:min-w-[360px]">
          <CardStack contentKey={pathname} cardsBehind={0}>
            {children}
          </CardStack>
        </div>
      </div>

      {/* Right: drenched Inari brand panel. lg+ only — the canvas + parallax
          stay off small screens, where the ambient paper field carries the
          background instead. */}
      <div className="relative z-10 hidden lg:block">
        <InariBrandPanel />
      </div>
    </main>
  )
}
