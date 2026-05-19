import { z } from 'zod'

import { DeckType } from '../deck.types.ts'

import { safeShortText } from '../sanitize.ts'

// Derived from the canonical DeckType const in shared-types.
export const deckTypeEnum = z.enum(Object.values(DeckType) as [DeckType, ...DeckType[]])

export const createDeckSchema = z.object({
  name:        safeShortText(100, 1),
  description: safeShortText(500).optional(),
  deckType:    deckTypeEnum.default('vocabulary'),
}).strict()

// Every field is optional — only present keys are written (true PATCH semantics).
export const updateDeckSchema = z.object({
  name:        safeShortText(100, 1).optional(),
  description: safeShortText(500).nullable().optional(),
  deckType:    deckTypeEnum.optional(),
  isPublic:    z.boolean().optional(),
}).strict()

// Validates the :id route parameter is a well-formed UUID.
export const deckIdParamSchema = z.object({
  id: z.string().uuid('Invalid deck ID'),
})

// Cursor pagination for GET /api/v1/decks. Mirrors the cards-list query shape.
// Opaque cursor — see lib/http.ts:encodeCursor.
export const listDecksQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
}).strict()

// Body for `POST /api/v1/decks/:id/copy`. The optional `name` overrides the
// server-side default "<source> (Copy)" naming. Length + sanitization rules
// match createDeckSchema so a copied deck can't acquire a name the create
// path would reject. Empty body `{}` is valid — the RPC resolves the default.
export const copyDeckSchema = z.object({
  name: safeShortText(100, 1).optional(),
}).strict()

export type CreateDeckInput   = z.infer<typeof createDeckSchema>
export type CreateDeckPayload = z.input<typeof createDeckSchema>
export type UpdateDeckInput   = z.infer<typeof updateDeckSchema>
export type UpdateDeckPayload = z.input<typeof updateDeckSchema>
export type ListDecksQuery    = z.infer<typeof listDecksQuerySchema>
export type CopyDeckInput     = z.infer<typeof copyDeckSchema>
export type CopyDeckPayload   = z.input<typeof copyDeckSchema>
