export type GreetingTimeBucket = 'morning' | 'afternoon' | 'evening' | 'late'

export function getGreetingBucket(hour: number): GreetingTimeBucket {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late'
}

export function getJapaneseGreeting(hour: number): string {
  switch (getGreetingBucket(hour)) {
    case 'morning':   return 'おはよう'
    case 'afternoon': return 'こんにちは'
    case 'evening':   return 'こんばんは'
    case 'late':      return 'おかえり'
  }
}

export function getEnglishWelcomeClause(bucket: GreetingTimeBucket): string {
  switch (bucket) {
    case 'morning':   return 'Pour the coffee.'
    case 'afternoon': return 'Pull up a chair.'
    case 'evening':   return 'The lamp is on.'
    case 'late':      return 'One or two is plenty.'
  }
}
