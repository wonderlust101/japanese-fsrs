'use client'

import { useEffect, useRef } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   QueueErrorPane

   Shared page-level error surface for routes whose primary purpose is
   "show today's queue" (e.g. /today, /review/setup). Replaces the
   whole content column when the critical queue queries fail.
   Designed to read as "the same surface, paused" rather than a
   separate alarmed system:

     - warm-paper background, no error-red on stripe/border/CTA
     - one quiet error-deep status indicator (the dot + label)
     - brand-vermillion Refresh CTA (same button system as the
       rest of Tomo)
     - kanji 静 (calm/quiet) instead of the dramatic 断 (severed)
   ────────────────────────────────────────────────────────────────────── */

interface QueueErrorPaneProps {
  /** Re-fires the critical TanStack queries. */
  onRefresh: () => void
  /** True while a refetch is in flight; disables the button + dims label. */
  refreshing?: boolean
}

export function QueueErrorPane({
  onRefresh,
  refreshing = false,
}: QueueErrorPaneProps): React.JSX.Element {
  const refreshRef = useRef<HTMLButtonElement | null>(null)

  // Auto-focus the Refresh action on mount. When a learner's Wi-Fi drops
  // mid-session, one Enter press should get them moving again without
  // hunting for the button. Skipped if focus is inside a form control via
  // a recent keyboard interaction (defensive against stealing focus from
  // a sidebar route change).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const active = document.activeElement
    const inForm = active instanceof HTMLInputElement
      || active instanceof HTMLTextAreaElement
      || active instanceof HTMLSelectElement
    if (inForm) return
    refreshRef.current?.focus()
  }, [])

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex min-h-[60vh] flex-1 items-start justify-center px-6 pt-12 sm:pt-16 md:px-12 lg:items-center lg:px-16 lg:pt-0"
    >
      <div className="flex w-full max-w-measure flex-col items-start">
        <span
          aria-hidden="true"
          lang="ja"
          className="font-display text-[1.75rem] leading-none text-faded-sumi"
        >
          静
        </span>

        <h2 className="mt-6 font-display text-title text-sumi-ink">
          Couldn&rsquo;t reach your queue.
        </h2>

        <p className="mt-3 max-w-measure break-words text-base leading-relaxed text-faded-sumi">
          Your decks are unchanged. Try refreshing once your connection is back.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-error-deep"
          />
          <span className="font-mono text-sm text-faded-sumi">
            Not connected
          </span>
        </div>

        <div className="mt-7 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <button
            ref={refreshRef}
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing ? true : undefined}
            className={[
              'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[2px] px-6 py-3',
              'sm:w-auto sm:min-w-[12rem] sm:px-8',
              'text-base font-semibold',
              'today-hero-primary-action bg-inari-vermillion text-warm-paper-raised',
              'today-motion-colors',
              'hover:bg-inari-vermillion-deep active:bg-inari-vermillion-deep active:shadow-[inset_0_1px_2px_rgba(31,26,24,0.12)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
              'disabled:cursor-progress disabled:opacity-70',
            ].join(' ')}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  )
}
