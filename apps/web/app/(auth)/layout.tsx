import type { Metadata } from 'next'
import { AuthShell } from './_components/auth-shell'

// Inherits the `%s | Tomo` template from the root layout (app/layout.tsx).
// The whole auth tree is `noindex` because it's a private app's sign-in surface
// — no SEO value, and indexing leaks user-flow URLs into search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Auth layout. Delegates to AuthShell, which owns the persistent centered
 * card chrome and the route-level CardStack that animates /login ↔ /signup.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <AuthShell>{children}</AuthShell>
}
