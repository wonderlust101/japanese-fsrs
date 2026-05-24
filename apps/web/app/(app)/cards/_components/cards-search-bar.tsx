'use client'

import { useEffect, useRef, useState } from 'react'

import { KbdChip } from '@/components/ui/KbdChip'
import { SearchInput } from '@/components/ui/SearchInput'

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
    <SearchInput
      ref={inputRef}
      value={draft}
      onChange={setDraft}
      placeholder={placeholder ?? 'Search by word, reading, meaning, sentence, tag…'}
      ariaLabel="Search cards"
      trailing={
        <KbdChip
          placement="floating"
          className="hidden sm:inline-flex"
          ariaLabel="Press Cmd K to focus search"
        >
          ⌘K
        </KbdChip>
      }
    />
  )
}
