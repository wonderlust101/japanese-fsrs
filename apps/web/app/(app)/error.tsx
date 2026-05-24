'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { useCopyConfirmation } from '@/hooks/use-copy-confirmation'
import { reportError } from '@/lib/report-error'

import {
  buildMarkdownReport,
  DevPanel,
  EmptyPathVisual,
  FullReloadHint,
  HeroKicker,
  IdentityStrip,
  InlinePath,
  InlinePathsRow,
  PageBody,
  PageHeadline,
  PageStateFrame,
  PrimaryAction,
  VisualSlot,
} from '../_components/page-state'

/**
 * In-shell error boundary for authenticated app routes. Catches errors
 * thrown inside any (app)/* page; the sidebar and top-bar remain visible
 * so the user has a clear escape via the existing nav.
 *
 * The composition omits the IdentityStrip (sidebar has the logo) and
 * drops "Back to dashboard" from the inline row (sidebar has the link).
 * Only the unique affordance — "Report this" — stays inline.
 *
 * Errors thrown by the (app) layout itself (the Sidebar component, the
 * TopBar, etc.) bypass this boundary and bubble up to `app/error.tsx`,
 * which renders full-bleed. That's the design intent: when the shell is
 * the problem, render without the shell.
 */
interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Retry counter persists across re-mounts via sessionStorage, keyed by
 * `error.digest`. Without this, Next.js unmounting the boundary on each
 * reset would reset `useState(0)` and prevent the soft-retry escalation
 * from ever triggering. Mirrors the root error.tsx's persistence helpers.
 */
function readRetryCount(digest: string | undefined): number {
  if (typeof sessionStorage === 'undefined') return 0
  const raw = sessionStorage.getItem(`tomo.error.retries.${digest ?? 'unknown'}`)
  const n   = Number(raw ?? '0')
  return Number.isFinite(n) ? n : 0
}

function writeRetryCount(digest: string | undefined, count: number): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(`tomo.error.retries.${digest ?? 'unknown'}`, String(count))
}

export default function AppError({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
  const pathname = usePathname()
  const [retries, setRetries] = useState<number>(() => readRetryCount(error.digest))
  const { copied: reported, copy: copyReport } = useCopyConfirmation()

  useEffect(() => {
    reportError(error, { source: '(app) error boundary', pathname, digest: error.digest })
  }, [error, pathname])

  function handleRetry(): void {
    const next = retries + 1
    setRetries(next)
    writeRetryCount(error.digest, next)
    reset()
  }

  function handleFullReload(): void {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  function handleReport(): void {
    const isDev = process.env.NODE_ENV === 'development'
    const payload = buildMarkdownReport({
      name:     isDev ? error.name : undefined,
      message:  error.message,
      digest:   error.digest,
      stack:    isDev ? error.stack : undefined,
      pathname,
      time:     new Date().toISOString(),
      browser:  typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    })
    copyReport(payload)
  }

  return (
    <PageStateFrame variant="inshell">
      <IdentityStrip tone="error" />
      <HeroKicker kanji="復" label="Practice paused" tone="error" />
      <VisualSlot>
        <EmptyPathVisual kanji="復" label="Practice paused" tone="error" />
      </VisualSlot>
      <PageHeadline tone="error">
        Something went wrong loading this page.
      </PageHeadline>
      <PageBody>Nothing on the schedule has changed.</PageBody>
      <PrimaryAction tone="error" onClick={handleRetry}>
        Try again
      </PrimaryAction>
      <InlinePathsRow>
        <InlinePath onClick={handleReport}>
          {reported ? 'Copied' : 'Report this'}
        </InlinePath>
      </InlinePathsRow>
      {retries >= 2 && <FullReloadHint onClick={handleFullReload} />}
      <DevPanel
        error={{
          name:    error.name,
          message: error.message,
          digest:  error.digest,
          stack:   error.stack,
        }}
        pathname={pathname}
      />
    </PageStateFrame>
  )
}
