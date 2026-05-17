'use client'

import { useEffect, useRef } from 'react'

type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

interface DialogProps {
  open:     boolean
  onClose:  () => void
  title:    string
  /**
   * Optional brand eyebrow rendered above the title. Mirrors the
   * `PageHeader` rhythm (kanji + small-caps label) so the modal reads as
   * part of the Tomo register, not a generic system popup.
   *
   * Pass `null` (or omit) to keep the title-only header.
   */
  eyebrow?: { kanji: string; label: string } | null
  /** Maximum width tier. Defaults to `md` (28rem) for legacy callers. */
  size?:    DialogSize
  children: React.ReactNode
}

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: 'max-w-sm',   // 24rem
  md: 'max-w-md',   // 28rem
  lg: 'max-w-lg',   // 32rem
  xl: 'max-w-xl',   // 36rem
}

/**
 * Brand-aligned modal dialog.
 *
 * Chrome mirrors `SectionCard`: 2px corners, 1px soft-hairline border, 2px
 * Inari Vermillion top stripe. Warm paper raised surface; soft sumi-ink
 * backdrop with a 2px blur for stage separation. Uses the native `<dialog>`
 * element for modal focus trap and top-layer rendering.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  size = 'md',
  children,
}: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open  && !el.open) el.showModal()
    if (!open &&  el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className={[
        // Modal box: 2px corners + hairline border + warm paper raised.
        'relative m-auto w-full overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised p-0 shadow-[var(--shadow-lg)]',
        SIZE_CLASS[size],
        // Backdrop: sumi-ink at 40% + a 2px blur to deepen the modal stage.
        '[&::backdrop]:bg-sumi-ink/40 [&::backdrop]:backdrop-blur-[2px]',
      ].join(' ')}
    >
      {/* Brand identity stripe — the same 2px Vermillion bar that crowns
          every SectionCard surface across the app. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion"
      />

      <div className="px-6 pt-7 pb-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow !== undefined && eyebrow !== null && (
              <p className="mb-1.5 flex items-baseline gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
                <span
                  lang="ja"
                  aria-hidden="true"
                  className="font-display text-sm leading-none translate-y-[0.05em] text-inari-vermillion"
                >
                  {eyebrow.kanji}
                </span>
                <span>{eyebrow.label}</span>
              </p>
            )}
            <h2 className="text-lg font-medium leading-tight text-sumi-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-motion-colors -mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
