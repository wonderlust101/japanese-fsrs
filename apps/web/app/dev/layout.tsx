import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title:  'Dev tools',
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Hard 404 in any non-dev environment so the surface is invisible in
  // staging / production even if someone deep-links the URL.
  if (process.env.NODE_ENV !== 'development') notFound()

  return <div className="min-h-screen bg-cool-paper-base text-sumi-ink">{children}</div>
}
