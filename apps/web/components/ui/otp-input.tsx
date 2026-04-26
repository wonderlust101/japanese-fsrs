'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OTPInputProps {
  /** Called automatically as soon as all 6 digits are present. */
  onComplete: (otp: string) => void
  /**
   * When truthy the component shakes, clears all inputs, and returns focus
   * to the first digit. Set to null/'' before a retry so the shake can
   * re-trigger if the subsequent attempt also fails.
   */
  error?: string | null
  /** Dims the inputs and disables interaction while an API call is in-flight. */
  isLoading?: boolean
  className?: string
}

// ── OTPInput ──────────────────────────────────────────────────────────────────

export function OTPInput({ onComplete, error, isLoading = false, className }: OTPInputProps) {
  const [digits, setDigits]   = useState<string[]>(Array(6).fill(''))
  const [shaking, setShaking] = useState(false)
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([])

  // Shake + clear whenever the parent signals an error.
  useEffect(() => {
    if (!error) return
    setDigits(Array(6).fill(''))
    setShaking(true)
    // Return focus to the first digit after the DOM has updated.
    requestAnimationFrame(() => inputRefs.current[0]?.focus())
  }, [error])

  function updateDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next  = digits.slice()
    next[index] = digit

    setDigits(next)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (next.every((d) => d !== '')) {
      onComplete(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Move back on Backspace in an already-empty field.
    if (e.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      return
    }
    // Block non-digit printable characters (allow control keys: Backspace,
    // Tab, arrows, Copy/Paste shortcuts via Ctrl/Cmd).
    if (
      e.key.length === 1 &&
      !/\d/.test(e.key) &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      e.preventDefault()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    // Paste always fills from digit 0 regardless of which box is focused —
    // this matches how users expect a 6-digit OTP paste to behave.
    const next = Array(6).fill('').map((_, i) => pasted[i] ?? '') as string[]
    setDigits(next)

    inputRefs.current[Math.min(pasted.length, 5)]?.focus()

    if (pasted.length === 6) {
      onComplete(pasted)
    }
  }

  const hasError = !!error

  return (
    // Outer div handles the shake animation — animating the wrapper moves all
    // inputs together without disrupting the flex layout.
    <div
      role="group"
      aria-label="One-time password"
      className={cn(
        'flex items-center gap-2',
        shaking && 'animate-otp-shake',
        className,
      )}
      onAnimationEnd={() => setShaking(false)}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          // The first box opts into the browser's OTP autofill on mobile.
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={isLoading}
          aria-label={`Digit ${i + 1} of 6`}
          onChange={(e) => updateDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            // Size — smaller on mobile, full-spec on sm+ (≥640px)
            'w-11 h-14 sm:w-[52px] sm:h-[60px]',
            // Typography: monospace, large, centred
            'font-mono text-2xl font-semibold text-center text-neutral-900',
            // Surface
            'bg-neutral-100 rounded-[var(--radius-md)]',
            // Focus ring + border
            'outline-none transition-colors duration-150',
            'focus:ring-[3px] focus:ring-primary-200 focus:border-primary-500',
            // State-specific borders
            hasError
              ? 'border-2 border-danger-500'
              : 'border border-neutral-300',
            // Disabled
            isLoading && 'opacity-40 cursor-not-allowed',
            // Visual break after the third digit (3 + 3 grouping)
            i === 2 && 'mr-2 sm:mr-4',
          )}
        />
      ))}
    </div>
  )
}
