'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ActionLink   { label: string; href: string;   onClick?: never }
interface ActionButton { label: string; onClick: () => void; href?: never }
type SnackbarAction = ActionLink | ActionButton

interface Props {
  message:    string
  actions:    SnackbarAction[]
  onTimeout?: () => void
  /** Auto-dismiss after this many ms. Default 5000. */
  timeoutMs?: number
}

export function Snackbar({ message, actions, onTimeout, timeoutMs = 5000 }: Props): React.JSX.Element {
  useEffect(() => {
    if (onTimeout === undefined) return
    const t = setTimeout(onTimeout, timeoutMs)
    return () => clearTimeout(t)
  }, [onTimeout, timeoutMs])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-neutral-900 text-white shadow-lg max-w-[calc(100vw-2rem)]"
    >
      <span className="text-sm">{message}</span>
      <div className="flex items-center gap-1">
        {actions.map((a) =>
          a.href !== undefined ? (
            <Link
              key={a.label}
              href={a.href}
              className="px-2 py-1 rounded-[var(--radius-sm)] text-sm font-medium text-primary-200 hover:bg-white/10 transition-colors"
            >
              {a.label}
            </Link>
          ) : (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="px-2 py-1 rounded-[var(--radius-sm)] text-sm font-medium text-primary-200 hover:bg-white/10 transition-colors"
            >
              {a.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
