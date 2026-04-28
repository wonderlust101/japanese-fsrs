'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Counts down from `initialSeconds` to 0.
 * Returns the remaining seconds and a `restart` function to reset the timer.
 */
export function useCountdown(initialSeconds: number): { remaining: number; restart: () => void } {
  const [remaining, setRemaining] = useState(initialSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  useEffect(() => {
    start()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function restart() {
    setRemaining(initialSeconds)
    start()
  }

  return { remaining, restart }
}
