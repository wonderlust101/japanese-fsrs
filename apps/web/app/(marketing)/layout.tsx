import type { Metadata } from 'next'
import Link from 'next/link'

import { Logo } from '@/components/ui/Logo'

import { MarketingNav } from './_components/marketing-nav'

// The public, indexable surface (landing + privacy + terms + help). This is the
// only tree that opts INTO indexing — the (app), (auth), and onboarding trees
// all set `robots: { index: false }`. Being explicit here documents intent and
// guards against the root default ever flipping.
export const metadata: Metadata = {
  robots: { index: true, follow: true },
}

const NAV_LINK =
  'rounded-xs text-sm font-medium text-faded-sumi transition-colors hover:text-sumi-ink ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2'

/**
 * Public marketing chrome: a quiet header (brand mark + sign-in / start) and a
 * footer (legal + help). The page beneath uses Cool Paper Base so it reads as
 * the same "tool surface" register as the app — two registers, one identity
 * (PRODUCT Design Principle #1).
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-cool-paper-base text-sumi-ink">
      {/* Skip link — first focusable element, mirrors the (app) shell. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[var(--z-toast)] focus-visible:rounded-xs focus-visible:border focus-visible:border-soft-hairline focus-visible:bg-warm-paper-raised focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-sumi-ink focus-visible:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
      >
        Skip to main content
      </a>

      <MarketingNav />

      {/* The nav is fixed and transparent over the landing hero. `pt-16` clears
          its 4rem height on every marketing page by default; the landing hero
          opts back out with a `-mt-16` so it can extend behind the nav. */}
      <main id="main-content" tabIndex={-1} className="flex-1 pt-16 outline-none">
        {children}
      </main>

      <footer className="border-t border-soft-hairline">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-col gap-1">
            <Logo size={32} wordmarkSize="sm" />
            <p className="text-sm text-faded-sumi">Japanese spaced repetition, made calm.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/help" className={NAV_LINK}>Help</Link>
            <Link href="/privacy" className={NAV_LINK}>Privacy</Link>
            <Link href="/terms" className={NAV_LINK}>Terms</Link>
            <Link href="/login" className={NAV_LINK}>Sign in</Link>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-5xl px-6 pb-8 sm:px-8">
          <p className="text-xs text-faded-sumi">© {new Date().getFullYear()} Tomo</p>
        </div>
      </footer>
    </div>
  )
}
