'use client'

import { useEffect } from 'react'

/**
 * Listens for digit keys 1–9 and dispatches to a callback when within range.
 * Skips events from form fields so typing into an input doesn't fire selections.
 */
export function useNumberKey(max: number, onSelect: (index: number) => void): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > max) return

      e.preventDefault()
      onSelect(n - 1)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [max, onSelect])
}
