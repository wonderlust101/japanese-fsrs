import type { JLPTLevel } from './card.types.ts'

export interface Profile {
  id: string
  username: string | null
  nativeLanguage: string
  jlptTarget: JLPTLevel | null
  studyGoal: string | null
  interests: string[]
  dailyNewCardsLimit: number
  dailyReviewLimit: number
  retentionTarget: number
  timezone: string
  createdAt: Date
  updatedAt: Date
}
