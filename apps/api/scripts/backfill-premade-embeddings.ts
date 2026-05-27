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
import { backfillPremadeEmbeddings } from "../src/services/card.service.ts";

// Distinguish three exit modes for cron / CI parsers reading this output:
//   0 — full success
//   1 — ran cleanly but ≥1 card failed (per-card failures are inside summary.failed)
//   2 — script crashed (DB unreachable, OPENAI_API_KEY unset, etc.)
// Without the try/catch the third mode surfaced as an unhandled-rejection
// stack dump that broke any parser expecting a JSON line on stdout.
try {
	const summary = await backfillPremadeEmbeddings();
	console.log(JSON.stringify(summary, null, 2));
	process.exit(summary.failed > 0 ? 1 : 0);
} catch (err) {
	console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
	process.exit(2);
}
