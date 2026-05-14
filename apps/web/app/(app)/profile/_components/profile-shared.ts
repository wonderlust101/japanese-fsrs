/**
 * Shared formatters and props for the six Profile direction variants. Each
 * direction renders the same data in a different layout; this file holds
 * the parts that don't change between them.
 */

import type { Profile } from '@fsrs-japanese/shared-types'

export interface ProfileDirectionProps {
  profile:     Profile
  email:       string
  displayName: string
  joinedAt:    string
}

/** "May 2026" — joined-month copy used in the inline fact line and the
 *  hero greeting. Returns "recently" if the timestamp can't be parsed. */
export function formatJoinedMonth(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

/** Display label for a JLPT level. "N5" stays "N5"; "beyond_jlpt" becomes
 *  "Beyond JLPT"; null becomes "Not set" (the profile has no target). */
export function formatJlptLevel(level: string | null): string {
  if (level === null) return 'Not set'
  if (level === 'beyond_jlpt') return 'Beyond JLPT'
  return level
}
