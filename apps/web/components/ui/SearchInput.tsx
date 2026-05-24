'use client'

import { forwardRef } from 'react'

import { IconSearch } from '@/components/icons/chrome-marks'

interface SearchInputProps {
  value:        string
  onChange:     (next: string) => void
  ariaLabel:    string
  placeholder?: string
  /** Optional content rendered at the right edge of the field. Reserves
   *  `pr-16` of right padding so the trailing element doesn't collide with
   *  the input text. Typically `<KbdChip>⌘K</KbdChip>` on top-level page
   *  searches that bind a keyboard shortcut. */
  trailing?:    React.ReactNode
  className?:   string
}

/**
 * The single search-field visual across the app. Mirrors the canonical
 * `<Input>` control surface (Cream Inset / Soft Hairline / 2px corners /
 * 1px Sumi focus outline at offset-2) but specializes in three ways:
 *
 *   1. Built-in leading `IconSearch` glyph at `left-2.5`.
 *   2. Renders as `type="search"` with the WebKit search-cancel button
 *      suppressed (so the browser-native "X" doesn't fight the design).
 *   3. Optional `trailing` slot that auto-reserves `pr-16` when used.
 *
 * The component is a controlled visual primitive only. Debounce, keyboard
 * shortcuts (Cmd-K), and persistence stay in the wrapping page — pass a
 * `ref` and drive focus from there.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, ariaLabel, placeholder, trailing, className }, ref) => {
    const rightPadding = trailing !== undefined ? 'pr-16' : 'pr-3'
    return (
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faded-sumi"
        >
          <IconSearch className="h-3.5 w-3.5" />
        </span>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={[
            'ui-motion-colors block h-10 w-full rounded-xs border border-soft-hairline bg-cream-inset pl-8 text-sm text-sumi-ink placeholder:text-faded-sumi',
            'hover:border-faded-sumi',
            'focus:outline focus:outline-1 focus:outline-sumi-ink focus:outline-offset-2',
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-search-decoration]:appearance-none',
            rightPadding,
            className ?? '',
          ].join(' ')}
        />
        {trailing !== undefined && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center">
            {trailing}
          </span>
        )}
      </div>
    )
  },
)

SearchInput.displayName = 'SearchInput'
