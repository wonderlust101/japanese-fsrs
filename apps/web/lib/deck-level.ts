import type { JlptPillLevel } from '@/components/ui/Pill'

const LEVEL_PATTERN = /(?:^|[^a-z0-9])N([1-5])(?:[^a-z0-9]|$)/i

export function inferDeckLevel(input: {
  name?:        string | null
  title?:       string | null
  description?: string | null
  subtitle?:    string | null
}): JlptPillLevel | null {
  const text = [
    input.name,
    input.title,
    input.description,
    input.subtitle,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')

  const levelMatch = text.match(LEVEL_PATTERN)
  if (levelMatch?.[1] !== undefined) {
    return `N${levelMatch[1]}` as JlptPillLevel
  }

  const normalized = text.toLowerCase()
  if (normalized.includes('beyond jlpt') || normalized.includes('beyond')) return 'beyond_jlpt'
  if (normalized.includes('kana') || normalized.includes('hiragana') || normalized.includes('katakana')) return 'kana'

  return null
}
