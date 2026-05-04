import type { JLPTLevel } from './card.types.ts'

export interface Profile {
  id: string
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

/**
 * Request body for PATCH /api/v1/profile.
 * All fields are optional — only those present are written (true PATCH semantics).
 * Keys are snake_case to match the wire format the API schema expects.
 */
export interface UpdateProfileInput {
  jlpt_target?:           JLPTLevel
  study_goal?:            string
  interests?:             string[]
  daily_new_cards_limit?: number
  daily_review_limit?:    number
  retention_target?:      number
  timezone?:              string
  native_language?:       string
}
