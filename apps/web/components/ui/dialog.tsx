'use client'

import { useEffect, useRef } from 'react'

interface DialogProps {
  open:     boolean
  onClose:  () => void
  title:    string
  children: React.ReactNode
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
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
      className="m-auto w-full max-w-md p-0 border-0 rounded-[var(--radius-xl)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-lg)] [&::backdrop]:bg-neutral-900/40"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
