'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OTPInputProps {
  /** Called automatically as soon as all 6 digits are present. */
  onComplete: (otp: string) => void
  /**
   * When truthy the component plays the shake animation and shows error borders.
   * The parent must remount this component (via a changed `key`) each time a
   * new error should trigger a shake — that resets digits and restarts the
   * animation with no JS timers or internal useEffect needed.
   */
  error?: string | null
  /** Dims the inputs and disables interaction while an API call is in-flight. */
  isLoading?: boolean
  className?: string
}

// ── OTPInput ──────────────────────────────────────────────────────────────────

export function OTPInput({ onComplete, error, isLoading = false, className }: OTPInputProps): React.JSX.Element {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const inputRefs           = useRef<(HTMLInputElement | null)[]>([])

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
    if (e.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      return
    }
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

    const next = Array<string>(6).fill('').map((_, i) => pasted[i] ?? '')
    setDigits(next)

    inputRefs.current[Math.min(pasted.length, 5)]?.focus()

    if (pasted.length === 6) {
      onComplete(pasted)
    }
  }

  const hasError = !!error

  return (
    <div
      role="group"
      aria-label="One-time password"
      className={cn(
        'flex items-center gap-2',
        // Shake plays on mount when the parent remounts this component on error.
        hasError && 'animate-otp-shake',
        className,
      )}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el
            // Focus the first box automatically when the component mounts
            // after an error (the parent increments the key to remount).
            if (i === 0 && el !== null && hasError) el.focus()
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={isLoading}
          aria-label={`Digit ${i + 1} of 6`}
          onChange={(e) => updateDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            'w-11 h-14 sm:w-[52px] sm:h-[60px]',
            'font-mono text-2xl font-semibold text-center text-neutral-900',
            'bg-neutral-100 rounded-[var(--radius-md)]',
            'outline-none transition-colors duration-150',
            'focus:ring-[3px] focus:ring-primary-200 focus:border-primary-500',
            hasError
              ? 'border-2 border-danger-500'
              : 'border border-neutral-300',
            isLoading && 'opacity-40 cursor-not-allowed',
            i === 2 && 'mr-2 sm:mr-4',
          )}
        />
      ))}
    </div>
  )
}
