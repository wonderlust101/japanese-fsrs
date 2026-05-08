/**
 * Shared error-message hygiene for log lines. Pino's `redact` config in
 * lib/logger.ts strips fields by name (e.g. `*.token`, `req.headers.authorization`),
 * but cannot catch substrings inside an `Error.message` or `Error.stack` —
 * those land in logs whole. The scrubber below catches OpenAI-formatted
 * API key fragments (the SDK echoes them in 401 messages) before any
 * persistent log sink.
 */

/**
 * Replace OpenAI-formatted API key tokens in a message-like input with a
 * fixed redaction marker. Accepts an Error or arbitrary value; non-Errors
 * are stringified.
 *
 * @example
 * scrubKeyish(new Error('Incorrect API key sk-proj-AbCd***WXYZ'))
 * // → 'Incorrect API key <redacted-key>'
 */
export function scrubKeyish(input: unknown): string {
  const msg = input instanceof Error ? input.message : String(input)
  return msg.replace(/sk-[A-Za-z0-9_*-]+/g, '<redacted-key>')
}

/**
 * Build a loggable summary of a thrown value: applies `scrubKeyish` to
 * `message` + `stack`, and walks one level of `cause` so the underlying
 * error (e.g. an OpenAI APIError wrapped in `ServiceUnavailableError`)
 * surfaces in incident triage. Capped at one level to avoid runaway loops
 * on malformed cause chains.
 */
export function summarizeErr(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const summary: Record<string, unknown> = {
      name:    err.name,
      message: scrubKeyish(err.message),
    }
    if (err.stack !== undefined) summary['stack'] = scrubKeyish(err.stack)
    const cause = (err as { cause?: unknown }).cause
    if (cause !== undefined) summary['cause'] = summarizeCause(cause)
    return summary
  }
  return { detail: String(err) }
}

/** One-level cause summary (no stack, no recursive cause walk). */
function summarizeCause(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name:    err.name,
      message: scrubKeyish(err.message),
    }
  }
  return { detail: String(err) }
}
