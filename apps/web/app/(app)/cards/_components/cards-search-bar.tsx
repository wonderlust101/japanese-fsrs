'use client'

import { useEffect, useRef, useState } from 'react'

import { IconSearch } from '@/components/icons/chrome-marks'

interface Props {
  /** Submitted search string (post-debounce). */
  value:    string
  /** Fires 250ms after the user stops typing. */
  onChange: (next: string) => void
  /** Optional placeholder override. */
  placeholder?: string
}

/**
 * Debounced search input. Cmd-K / Ctrl-K focuses it from anywhere on the
 * page. The visible input value is local; we only push to the parent
 * after a 250ms quiet period so result fetches don't fire on every
 * keystroke.
 */
export function CardsSearchBar({ value, onChange, placeholder }: Props): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Keep the local draft in sync when the parent resets the search
  // externally (e.g., a saved view applies its own filter set).
  useEffect(() => {
    setDraft(value)
  }, [value])

  // 250ms debounce → parent.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (draft !== value) onChange(draft)
    }, 250)
    return () => window.clearTimeout(id)
  }, [draft, value, onChange])

  // Cmd-K / Ctrl-K focuses the search.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        const active = document.activeElement
        if (active instanceof HTMLInputElement && active !== inputRef.current) return
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faded-sumi"
      >
        <IconSearch className="h-4 w-4" />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? 'Search by word, reading, meaning, sentence, tag…'}
        aria-label="Search cards"
        className={[
          'ui-motion-colors block h-11 w-full rounded-[2px] border border-soft-hairline bg-cream-inset pl-10 pr-16 text-base text-sumi-ink placeholder:text-faded-sumi',
          'hover:border-faded-sumi',
          'focus:outline focus:outline-1 focus:outline-sumi-ink focus:outline-offset-2',
          '[&::-webkit-search-cancel-button]:appearance-none',
          '[&::-webkit-search-decoration]:appearance-none',
        ].join(' ')}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 hidden h-6 -translate-y-1/2 items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-1.5 font-mono text-[0.625rem] tracking-tight text-faded-sumi sm:inline-flex"
      >
        ⌘K
      </kbd>
    </div>
  )
}
