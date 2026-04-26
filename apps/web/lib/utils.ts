type ClassValue = string | number | boolean | null | undefined

/**
 * Merges class name arguments, filtering out all falsy values.
 * Handles the same primitives as clsx without the array/object overloads,
 * which are not needed in this codebase.
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ')
}
