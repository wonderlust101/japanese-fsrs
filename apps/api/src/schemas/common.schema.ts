import { z } from 'zod'

/**
 * Cursor payload shared by every paginated list endpoint whose backing RPC
 * re-derives the sort key from the row pointed to by `id`. Callers wrap the
 * `id` of the last-returned row in this shape and `encodeCursor()` it; the
 * RPC reads it back via `decodeCursor(cursor, uuidIdCursorSchema)`.
 *
 * Object shape (not a bare string) preserves room to add fields — e.g. an
 * embedded sort marker — without a wire-format break.
 *
 * Consolidated from three previously identical inline copies in
 * card.service.ts, deck.service.ts, premade.service.ts.
 */
export const uuidIdCursorSchema = z.object({ id: z.string().uuid() })
