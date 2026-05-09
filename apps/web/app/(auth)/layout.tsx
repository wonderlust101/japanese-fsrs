import type { Metadata } from 'next'
import { AuthShell } from './_components/auth-shell'

export const metadata: Metadata = {
  title: {
    template: '%s | TOMO',
    default: 'TOMO',
  },
}

/**
 * Auth layout. Delegates to AuthShell, which owns the persistent centered
 * card chrome and the route-level CardStack that animates /login ↔ /signup.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <AuthShell>{children}</AuthShell>
}
