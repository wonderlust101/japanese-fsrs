/**
 * Populates embedding for premade source cards (user_id IS NULL,
 * premade_deck_id NOT NULL, embedding IS NULL).
 *
 * Run once after any deploy that introduces new premade source cards
 * (typically only after seed-deck migrations). Idempotent — only
 * operates on rows where embedding IS NULL.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 * The same env apps/api/.env uses to run the API; no extra secrets.
 *
 * Usage:
 *   bun --filter api run embeddings:backfill
 *   (or directly: bun run apps/api/scripts/backfill-premade-embeddings.ts)
 *
 * Exits 0 on full success, 1 if any card failed.
 */
import { backfillPremadeEmbeddings } from '../src/services/card.service.ts'

const summary = await backfillPremadeEmbeddings()
console.log(JSON.stringify(summary, null, 2))
process.exit(summary.failed > 0 ? 1 : 0)
