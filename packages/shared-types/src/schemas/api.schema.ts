/**
 * Zod schemas for every wire-format type the API returns to the web.
 * The TS types in `api.types.ts`, `review.types.ts`, and `user.types.ts`
 * are derived from these schemas via `z.infer` — schema-as-source so the
 * validator and the type cannot drift.
 */

import { z } from 'zod'

import { State } from 'ts-fsrs'

import { JLPTLevel, LayoutType } from '../card.types.ts'
import { CardType } from '../fsrs.types.ts'
import { DeckType } from '../deck.types.ts'
import { FieldsDataSchema } from './field-shapes.schema.ts'

// ─── Enum schemas (mirroring the const objects in shared-types) ───────────────

const layoutTypeSchema = z.enum(Object.values(LayoutType) as [LayoutType, ...LayoutType[]])
const cardTypeSchema   = z.enum(Object.values(CardType)   as [CardType,   ...CardType[]])
const jlptLevelSchema  = z.enum(Object.values(JLPTLevel)  as [JLPTLevel,  ...JLPTLevel[]])
const deckTypeSchema   = z.enum(Object.values(DeckType)   as [DeckType,   ...DeckType[]])
// ts-fsrs's State is a numeric enum — z.nativeEnum accepts numeric enums directly.
const stateSchema      = z.nativeEnum(State)

// ─── Cards ────────────────────────────────────────────────────────────────────

export const ApiCardSchema = z.object({
  id:             z.string(),
  userId:         z.string().nullable(),
  deckId:         z.string().nullable(),
  premadeDeckId:  z.string().nullable(),
  layoutType:     layoutTypeSchema,
  fieldsData:     FieldsDataSchema,
  cardType:       cardTypeSchema,
  parentCardId:   z.string().nullable(),
  tags:           z.array(z.string()),
  jlptLevel:      jlptLevelSchema.nullable(),
  state:          stateSchema,
  isSuspended:    z.boolean(),
  due:            z.string(),
  stability:      z.number(),
  difficulty:     z.number(),
  elapsedDays:    z.number(),
  scheduledDays:  z.number(),
  learningSteps:  z.number(),
  reps:           z.number(),
  lapses:         z.number(),
  lastReview:     z.string().nullable(),
  createdAt:      z.string(),
  updatedAt:      z.string(),
})

export const ApiDueCardSchema = ApiCardSchema.pick({
  id:         true,
  deckId:     true,
  cardType:   true,
  jlptLevel:  true,
  state:      true,
  due:        true,
  fieldsData: true,
  layoutType: true,
})

export const ApiCardListItemSchema = ApiCardSchema.pick({
  id:          true,
  fieldsData:  true,
  layoutType:  true,
  cardType:    true,
  jlptLevel:   true,
  state:       true,
  isSuspended: true,
  due:         true,
  tags:        true,
})

export const ApiSimilarCardSchema = z.object({
  id:         z.string(),
  deckId:     z.string(),
  layoutType: layoutTypeSchema,
  cardType:   cardTypeSchema,
  fieldsData: FieldsDataSchema,
  tags:       z.array(z.string()),
  jlptLevel:  jlptLevelSchema.nullable(),
  similarity: z.number(),
})

// ─── Decks ────────────────────────────────────────────────────────────────────

export const ApiDeckSchema = z.object({
  id:              z.string(),
  name:            z.string(),
  description:     z.string().nullable(),
  deckType:        deckTypeSchema,
  cardCount:       z.number(),
  isPremadeFork:   z.boolean(),
  sourcePremadeId: z.string().nullable(),
  createdAt:       z.string(),
  updatedAt:       z.string(),
})

export const ApiDeckWithStatsSchema = ApiDeckSchema.extend({
  dueCount: z.number(),
  newCount: z.number(),
})

// ─── Premade decks ────────────────────────────────────────────────────────────

export const ApiPremadeDeckSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().nullable(),
  deckType:    deckTypeSchema,
  jlptLevel:   jlptLevelSchema.nullable(),
  domain:      z.string().nullable(),
  cardCount:   z.number(),
  version:     z.number(),
  isActive:    z.boolean(),
  createdAt:   z.string(),
  updatedAt:   z.string(),
})

export const ApiPremadeSubscriptionSchema = z.object({
  id:              z.string(),
  premadeDeckId:   z.string(),
  premadeDeckName: z.string(),
  deckId:          z.string(),
  cardCount:       z.number(),
  subscribedAt:    z.string(),
})

export const ApiSubscribeResultSchema = z.object({
  subscriptionId: z.string(),
  deckId:         z.string(),
  cardCount:      z.number(),
  alreadyExisted: z.boolean(),
})

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const ApiForecastDaySchema = z.object({
  date:  z.string(),
  count: z.number(),
})

/** Generic batch result — caller passes the per-item schema. */
export const ApiBatchResultSchema = <T>(
  item: z.ZodType<T>,
): z.ZodObject<{
  results: z.ZodArray<z.ZodType<T>>
  errors:  z.ZodArray<z.ZodObject<{ cardId: z.ZodString; error: z.ZodString }>>
}> =>
  z.object({
    results: z.array(item),
    errors:  z.array(z.object({ cardId: z.string(), error: z.string() })),
  })

export const ApiReviewedCardSchema = z.object({
  id:            z.string(),
  due:           z.string(),
  stability:     z.number(),
  difficulty:    z.number(),
  scheduledDays: z.number(),
  state:         stateSchema,
})

export const ApiReviewSubmitResponseSchema = z.object({
  card: ApiReviewedCardSchema,
})

// ─── Analytics ────────────────────────────────────────────────────────────────

export const ApiHeatmapDaySchema = z.object({
  date:      z.string(),
  retention: z.number(),
  count:     z.number(),
})

export const ApiLayoutAccuracySchema = z.object({
  layout:      cardTypeSchema,
  total:       z.number(),
  successful:  z.number(),
  accuracyPct: z.number(),
})

export const ApiStreakStatsSchema = z.object({
  currentStreak:  z.number(),
  longestStreak:  z.number(),
  lastReviewDate: z.string().nullable(),
})

export const ApiJlptGapSchema = z.object({
  jlptLevel:   jlptLevelSchema,
  total:       z.number(),
  learned:     z.number(),
  due:         z.number(),
  progressPct: z.number(),
})

export const ApiMilestoneForecastSchema = z.object({
  jlptLevel:               jlptLevelSchema,
  total:                   z.number(),
  learned:                 z.number(),
  dailyPace:               z.number(),
  daysRemaining:           z.number().nullable(),
  projectedCompletionDate: z.string().nullable(),
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const ApiAuthTokensSchema = z.object({
  accessToken:  z.string(),
  refreshToken: z.string(),
  expiresIn:    z.number(),
})

export const ApiSignUpResultSchema = z.object({
  email:  z.string(),
  userId: z.string(),
})

// ─── Sessions / leeches (live in review.types.ts; cross the wire) ─────────────

export const SessionLeechSchema = z.object({
  leechId:      z.string(),
  cardId:       z.string(),
  deckId:       z.string(),
  word:         z.string(),
  reading:      z.string().nullable(),
  diagnosis:    z.string().nullable(),
  prescription: z.string().nullable(),
  resolved:     z.boolean(),
  createdAt:    z.string(),
})

export const SessionSummarySchema = z.object({
  sessionId:   z.string(),
  totalCards:  z.number(),
  totalTimeMs: z.number(),
  accuracyPct: z.number(),
  nextDueAt:   z.string().nullable(),
  ratingBreakdown: z.object({
    again: z.number(),
    hard:  z.number(),
    good:  z.number(),
    easy:  z.number(),
  }),
  leeches: z.array(SessionLeechSchema),
})

// ─── User profile (lives in user.types.ts; crosses the wire) ──────────────────

export const ProfileSchema = z.object({
  id:                 z.string(),
  nativeLanguage:     z.string(),
  jlptTarget:         jlptLevelSchema.nullable(),
  studyGoal:          z.string().nullable(),
  interests:          z.array(z.string()),
  dailyNewCardsLimit: z.number(),
  dailyReviewLimit:   z.number(),
  retentionTarget:    z.number(),
  timezone:           z.string(),
  createdAt:          z.string(),
  updatedAt:          z.string(),
})

// ─── Helpers for void responses ──────────────────────────────────────────────

/** For 204 No Content / DELETE / PATCH endpoints that don't return a body. */
export const voidResponseSchema = z.unknown()
