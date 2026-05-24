'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface TomoSelectOption<T extends string> {
  value: T
  label: string
}

interface TomoSelectProps<T extends string> {
  value:           T
  options:         readonly TomoSelectOption<T>[]
  onValueChange:   (v: T) => void
  id?:             string
  ariaLabel?:      string
  ariaLabelledBy?: string
  /** Space-separated id list for the trigger's `aria-describedby`. Use to
   *  associate an external hint/error paragraph (mirrors `Input`). The
   *  `| undefined` admits an explicit-undefined caller under
   *  `exactOptionalPropertyTypes`, matching `Input`'s `error` prop. */
  ariaDescribedBy?: string | undefined
  placeholder?:    string
  disabled?:       boolean
  className?:      string
}

/**
 * Brand-native dropdown. Built as a combobox + listbox popover so the full
 * popup is ours to style. Trigger matches Tomo's existing Input visual
 * register; the popover follows the warm-paper-on-page pattern (Warm Paper
 * Raised + 1px Soft Hairline border + popover-lift shadow + 2px corners).
 *
 * ARIA contract follows the WAI-ARIA Practices Guide combobox-with-listbox
 * pattern:
 *
 *   Trigger:  role="combobox", aria-haspopup="listbox",
 *             aria-expanded, aria-controls={listboxId},
 *             aria-activedescendant when an option is focused.
 *   Popover:  role="listbox", id={listboxId}.
 *   Options:  role="option", aria-selected, unique id per index.
 *
 * Focus stays on the trigger throughout. The "focused option" is signalled
 * via aria-activedescendant rather than DOM focus, which is the standard
 * combobox pattern (it lets keyboard navigation work without rebinding
 * focus on every arrow press).
 *
 * The popover renders via createPortal into document.body so it's never
 * clipped by ancestor overflow-hidden containers. Position is computed from
 * the trigger's getBoundingClientRect() on open and on scroll; if the
 * popover would extend below the viewport, it flips above the trigger.
 *
 * Keyboard contract:
 *   Enter / Space / ArrowDown on trigger - open, focus selected option
 *   ArrowUp on trigger when closed       - open, focus last option
 *   ArrowDown / ArrowUp when open        - move focused option (wraps)
 *   Home / End when open                 - jump to first / last
 *   Enter when open                      - select focused, close
 *   Esc when open                        - close without commit
 *   Tab when open                        - close without commit, advance focus
 *   Printable character                  - type-to-search by label prefix
 */
export function TomoSelect<T extends string>({
  value, options, onValueChange,
  id, ariaLabel, ariaLabelledBy, ariaDescribedBy,
  placeholder, disabled = false,
  className,
}: TomoSelectProps<T>): React.JSX.Element {
  const generatedId = useId()
  const baseId    = id ?? generatedId
  const listboxId = `${baseId}-listbox`

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLUListElement | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchBufferRef = useRef<string>('')

  const [isOpen,       setIsOpen]       = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [position,     setPosition]     = useState<{ top: number; left: number; width: number; flipped: boolean } | null>(null)
  const [mounted,      setMounted]      = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const selectedLabel  = selectedOption?.label ?? placeholder ?? ''

  const updatePosition = useCallback((): void => {
    const trigger = triggerRef.current
    if (trigger === null) return
    const rect = trigger.getBoundingClientRect()
    const maxPopoverHeight = 256 // matches max-h-64 below
    const spaceBelow = window.innerHeight - rect.bottom
    const flipped = spaceBelow < maxPopoverHeight + 8 && rect.top > maxPopoverHeight + 8

    setPosition({
      top:    flipped ? rect.top - 4 : rect.bottom + 4,
      left:   rect.left,
      width:  rect.width,
      flipped,
    })
  }, [])

  // Open: compute position, set focused option to current selection, listen
  // for scroll/resize to keep the popover in place.
  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0)

    function handleScroll(): void {
      // Recompute position rather than closing — keeps the dropdown usable
      // when an ancestor scrolls slightly (which can happen on page-level
      // scroll while the popover is open).
      updatePosition()
    }

    function handlePointerDownOutside(e: PointerEvent): void {
      const t = e.target as Node | null
      if (t === null) return
      const trigger = triggerRef.current
      const popover = popoverRef.current
      if (trigger?.contains(t) === true) return
      if (popover?.contains(t) === true) return
      setIsOpen(false)
    }

    window.addEventListener('scroll',  handleScroll, true)
    window.addEventListener('resize',  updatePosition)
    document.addEventListener('pointerdown', handlePointerDownOutside)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [isOpen, selectedIndex, updatePosition])

  // Scroll the focused option into view inside the popover when it changes.
  useLayoutEffect(() => {
    if (!isOpen || focusedIndex < 0) return
    const popover = popoverRef.current
    if (popover === null) return
    const optionEl = popover.querySelector<HTMLLIElement>(`#${baseId}-option-${focusedIndex}`)
    optionEl?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex, isOpen, baseId])

  function openMenu(initialIndex?: number): void {
    if (disabled) return
    setIsOpen(true)
    if (initialIndex !== undefined) setFocusedIndex(initialIndex)
  }

  function closeMenu(returnFocus: boolean = true): void {
    setIsOpen(false)
    setFocusedIndex(-1)
    searchBufferRef.current = ''
    if (returnFocus) triggerRef.current?.focus()
  }

  function commit(index: number): void {
    const opt = options[index]
    if (opt === undefined) return
    if (opt.value !== value) onValueChange(opt.value)
    closeMenu()
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openMenu(selectedIndex >= 0 ? selectedIndex : 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1)
      }
      return
    }

    // Open state.
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((i) => (i + 1) % options.length)
        return
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => (i - 1 + options.length) % options.length)
        return
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        return
      case 'End':
        e.preventDefault()
        setFocusedIndex(options.length - 1)
        return
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0) commit(focusedIndex)
        return
      case 'Escape':
        e.preventDefault()
        closeMenu()
        return
      case 'Tab':
        // Close without commit, then let the browser advance focus
        // normally. Don't preventDefault.
        setIsOpen(false)
        setFocusedIndex(-1)
        return
    }

    // Type-to-search. Single printable characters only.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const buffer = (searchBufferRef.current + e.key).toLowerCase()
      searchBufferRef.current = buffer
      if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        searchBufferRef.current = ''
      }, 300)
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(buffer))
      if (match >= 0) setFocusedIndex(match)
    }
  }

  function handleTriggerClick(): void {
    if (disabled) return
    if (isOpen) closeMenu()
    else openMenu(selectedIndex >= 0 ? selectedIndex : 0)
  }

  const activeOptionId = focusedIndex >= 0 ? `${baseId}-option-${focusedIndex}` : undefined

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        id={baseId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-disabled={disabled ? true : undefined}
        disabled={disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={[
          // 44px touch target on mobile (WCAG 2.5.5), 40px at pointer-precision
          // widths — mirrors the option-row sizing inside the popover.
          'group relative inline-flex h-11 sm:h-10 w-full items-center justify-between gap-3 rounded-[2px]',
          'border border-soft-hairline bg-cream-inset px-3 text-left text-sm text-sumi-ink',
          'ui-motion-colors hover:border-faded-sumi',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          isOpen ? 'border-faded-sumi' : '',
          className ?? '',
        ].join(' ')}
      >
        <span className={[
          'min-w-0 truncate',
          selectedIndex < 0 ? 'text-faded-sumi' : '',
        ].join(' ')}>
          {selectedLabel}
        </span>
        <ChevronGlyph open={isOpen} />
      </button>

      {mounted && isOpen && position !== null && createPortal(
        <ul
          ref={popoverRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          className={[
            'fixed z-[60] max-h-64 overflow-y-auto rounded-[2px]',
            'border border-soft-hairline bg-warm-paper-raised shadow-card',
            'py-1',
          ].join(' ')}
          style={{
            top:    position.flipped ? undefined : position.top,
            bottom: position.flipped ? window.innerHeight - position.top : undefined,
            left:   position.left,
            width:  position.width,
          }}
        >
          {options.map((option, index) => {
            const isFocused  = index === focusedIndex
            const isSelected = option.value === value
            return (
              <li
                key={option.value}
                id={`${baseId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setFocusedIndex(index)}
                onClick={() => commit(index)}
                className={[
                  // 44px touch target on mobile (WCAG 2.5.5 AAA); h-9
                  // (36px) on desktop keeps the popover dense at
                  // pointer-precision widths. Mirrors the same pattern
                  // applied to MenuItem and the cards-page chips so the
                  // entire app speaks one touch-sizing dialect.
                  'flex h-11 sm:h-9 cursor-pointer items-center gap-2 px-3 text-sm ui-motion-colors',
                  isSelected
                    ? 'bg-vermillion-wash text-inari-vermillion-deep'
                    : isFocused
                      ? 'bg-cream-inset text-sumi-ink'
                      : 'text-sumi-ink hover:bg-cream-inset',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'inline-block h-1.5 w-1.5 rounded-full transition-colors',
                    isSelected ? 'bg-inari-vermillion' : 'bg-transparent',
                  ].join(' ')}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </>
  )
}

function ChevronGlyph({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={[
        'shrink-0 text-faded-sumi transition-transform duration-200 ease-out',
        'group-hover:text-sumi-ink/75',
        open ? 'rotate-180 text-inari-vermillion' : '',
      ].join(' ')}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  )
}
