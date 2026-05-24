'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Moves keyboard focus to the page's <main> on client-side route changes so
 * screen-reader users are told the page changed — SPA navigations don't move
 * focus by default. Skips the initial mount (the browser already focuses the
 * document on first load). `preventScroll` avoids fighting Next's scroll
 * restoration. Mounted once in the (app) layout; targets `#main-content`.
 */
export function RouteFocusManager(): null {
  const pathname  = usePathname()
  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false
      return
    }
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}
