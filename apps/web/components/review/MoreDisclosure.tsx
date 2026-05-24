'use client'

import { useState } from 'react'

import { IconChevronDown } from '@/components/icons/chrome-marks'
import { cn } from '@/lib/utils'

interface MoreDisclosureProps {
  label?:    string
  children:  React.ReactNode
  defaultOpen?: boolean
}

// Lightweight expandable region under the essentials wave. Holds nuance,
// mnemonic, audio, and any teaching content the IA says should not appear by
// default. Chevron + label, plain-serif type — no card-in-a-card.

export function MoreDisclosure({
  label    = 'More',
  children,
  defaultOpen = false,
}: MoreDisclosureProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'group inline-flex items-center gap-2 text-sm text-faded-sumi',
          'hover:text-sumi-ink transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px]',
        )}
      >
        <IconChevronDown
          aria-hidden="true"
          className={cn(
            'w-3.5 h-3.5 transition-transform duration-200 ease-out',
            open ? 'rotate-180' : 'rotate-0',
          )}
        />
        <span className="font-mono text-sm">
          {open ? `Less ${label.toLowerCase() === 'more' ? '' : label}`.trim() : label}
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-y-3 text-sumi-ink animate-card-reveal">
          {children}
        </div>
      )}
    </div>
  )
}
