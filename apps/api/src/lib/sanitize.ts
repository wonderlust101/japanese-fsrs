import { z } from 'zod'

/** Strip every HTML/XML-tag-like substring from a string. */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/** True if the string contains markup-like content we don't want persisted. */
export function looksLikeHtml(input: string): boolean {
  return /<[a-zA-Z][^>]*>?/.test(input)
      || /javascript:|data:text\/html|on[a-z]+\s*=/i.test(input)
}

/** Zod refine: false on inputs that look like markup. */
export const noMarkupRefine = (s: string): boolean => !looksLikeHtml(s)

/** Zod transform: strip markup. Use on AI/LLM output we don't fully trust. */
export const stripMarkupTransform = (s: string): string => stripHtml(s).trim()

/**
 * Harden a user-supplied string before it enters an LLM prompt: collapse
 * whitespace, drop quote characters that could break out of the prompt
 * structure, cap length. Defence-in-depth — JSON mode + output schema
 * validation do the heavy lifting against prompt injection.
 */
export function sanitizeForPrompt(input: string, maxLen = 100): string {
  return stripHtml(input)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[`"']/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

/** A short user-typed string with no markup, trimmed, length-bounded. */
export const safeShortText = (max: number, min = 0) =>
  z.string()
    .min(min)
    .max(max)
    .trim()
    .refine(noMarkupRefine, 'Cannot contain HTML or script-like content')

/** Recursively check whether any string leaf in `value` looks like markup. */
export function deepHasMarkup(value: unknown): boolean {
  if (typeof value === 'string') return looksLikeHtml(value)
  if (Array.isArray(value)) return value.some(deepHasMarkup)
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(deepHasMarkup)
  }
  return false
}

/** Recursively check whether any string leaf in `value` exceeds `maxLen`. */
export function deepHasOversizedString(value: unknown, maxLen: number): boolean {
  if (typeof value === 'string') return value.length > maxLen
  if (Array.isArray(value)) return value.some((v) => deepHasOversizedString(v, maxLen))
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .some((v) => deepHasOversizedString(v, maxLen))
  }
  return false
}
