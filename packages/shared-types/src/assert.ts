/**
 * Exhaustiveness guard for closed discriminated unions.
 *
 * Call it in the `default` branch of a `switch` (or a final `else`) over a
 * union: when every variant is handled, `value` narrows to `never` and this
 * type-checks; when a new variant is later added, the call becomes a compile
 * error, forcing the new case to be handled rather than silently skipped.
 *
 * Returns `never`, so it is equally valid as a statement (`assertNever(x)`)
 * or in a value-returning position (`return assertNever(x)`).
 *
 * @param value   the unreachable value — typed `never` by exhaustive narrowing
 * @param message optional override for the thrown error's message
 */
export function assertNever(value: never, message?: string): never {
	throw new Error(message ?? `Unhandled union member: ${JSON.stringify(value)}`);
}
