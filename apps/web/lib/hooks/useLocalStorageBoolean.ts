'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe boolean preference backed by localStorage. Seeds the initial
 * render with the provided default so the server and first client render
 * agree; reads the stored value during the post-mount effect and rehydrates
 * if it differs. Writes back on subsequent state changes.
 *
 * Used by the Sidebar for the collapsed/expanded preference and by the
 * Decks section's "user manually collapsed" flag.
 */
export function useLocalStorageBoolean(
  key: string,
  initial: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(initial)
  const [hydrated, setHydrated] = useState<boolean>(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        setValue(stored === 'true')
      }
    } catch {
      // localStorage may be unavailable (privacy mode, SSR edge cases).
      // Silent fallback to the in-memory default.
    }
    setHydrated(true)
  }, [key])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(key, String(value))
    } catch {
      // Silent fallback as above.
    }
  }, [key, value, hydrated])

  return [value, setValue]
}
