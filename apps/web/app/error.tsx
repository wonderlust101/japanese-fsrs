'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

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
  useCopyConfirmation,
  VisualSlot,
} from './_components/page-state'

/**
 * Root error boundary. Renders full-bleed so it survives even when the
 * app shell itself is responsible for the failure (a broken sidebar, a
 * corrupted top-bar state). Next.js requires this file to be a Client
 * Component because it receives `reset`, which is a function and not
 * serializable across the server/client boundary.
 *
 * Voice: practice-aware, recovery-led. The kicker (復 · PRACTICE PAUSED)
 * frames the moment as a pause in the user's morning ritual, not a
 * "thing broke." The body ("Nothing on the schedule has changed.") tells
 * the user their FSRS state is intact, which is the load-bearing
 * reassurance for users with months of investment in their cards.
 *
 * Retry escalation: the primary `Try again` calls `reset()`, Next.js's
 * soft-retry which re-renders the error boundary's children without a
 * full reload. We track click count locally: after the user has tried
 * twice without the error clearing, a quieter `Full reload →` hint
 * appears so they have an escape hatch when soft retry isn't fixing
 * the problem (typically a corrupted client cache or stale chunk).
 */
interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Retry counter persists across re-mounts. Next.js may unmount this
 * component when `reset()` re-renders the boundary's children, and re-
 * mount a fresh instance if the error fires again — which would reset
 * `useState(0)` and make the soft-retry escalation never trigger.
 * sessionStorage is keyed by `error.digest` so the count is per-error,
 * resets on tab close, and degrades silently when storage is unavailable.
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

export default function RootError({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
  const pathname = usePathname()
  const [retries, setRetries] = useState<number>(() => readRetryCount(error.digest))
  const { copied: reported, copy: copyReport } = useCopyConfirmation()

  // Log the boundary firing so the failure shows up in browser devtools
  // even when the dev panel is collapsed. In production this still helps
  // anyone with the console open during a reproduction.
  useEffect(() => {
    console.error('[tomo] error boundary caught:', error)
  }, [error])

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
    // Production payload omits the stack trace: in a deployed environment
    // stacks are minified to the point of being unhelpful, and the digest
    // is what server-side logs are keyed by. The dev panel above carries
    // the full stack for local repros.
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
    <PageStateFrame variant="fullbleed">
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
        <InlinePath href="/today">Back to home</InlinePath>
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
