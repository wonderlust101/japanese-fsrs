-- =============================================================
-- Migration: 20260517000000_index_optimization.sql
--
-- Index audit findings (apps/api/src/services/ × supabase/migrations/):
-- 6 actionable changes with no service-layer touches required.
--
--   ADDs:
--     • cards_deck_pagination_idx (deck_id, created_at DESC, id DESC)
--         — makes list_cards_paginated an index-only scan; eliminates the
--           in-memory sort on the deck-browser hot path.
--     • cards_user_new_creation_idx (user_id, created_at)
--         WHERE state = 0 AND is_suspended = FALSE
--         — partial covering the new-cards FIFO branch in get_due_cards.
--           cards_due_active_idx already serves the WHERE filter, but the
--           ORDER BY created_at ASC falls out of its (user_id, state, due) key.
--     • decks_user_updated_idx (user_id, updated_at DESC)
--         — serves listDecks ORDER BY index-only.
--
--   DROPs:
--     • user_premade_subscriptions_user_id_idx
--         — strictly redundant with UNIQUE (user_id, premade_deck_id).
--           Postgres uses the leading column of the UNIQUE for user_id lookups.
--     • cards_user_id_due_idx (user_id, due)
--         — superseded by cards_due_active_idx
--           (user_id, state, due) WHERE is_suspended = FALSE. Every observed
--           user-scoped due query also filters state and is_suspended.
--     • cards_tags_gin_idx
--         — verified via grep across apps/api/src and SQL function bodies:
--           no query filters by tags. GIN indexes have substantial write
--           amplification on cards (the hottest write table — every review
--           is an UPDATE).
--     • decks_user_id_idx
--         — leading-column subsumed by the new decks_user_updated_idx.
--
-- Note: bunx supabase db push runs migrations inside a pipeline that
-- behaves like a transaction (SQLSTATE 25001 forbids CONCURRENTLY).
-- Plain CREATE/DROP INDEX is used here. Affected tables are small at
-- current scale, so the brief SHARE lock from non-CONCURRENTLY DDL is
-- acceptable. If we ever need CONCURRENTLY, we'd have to split each
-- statement into its own migration file and apply outside the pipeline.
--
-- Statement order: ADDs precede the matching DROPs of superseded indexes
-- so the planner always has a coverage path during the migration window.
-- =============================================================


-- ─── 1. user_premade_subscriptions: drop redundant simple-column index ────────

DROP INDEX IF EXISTS user_premade_subscriptions_user_id_idx;


-- ─── 2. cards: add deck-pagination composite ─────────────────────────────────
-- Serves: list_cards_paginated WHERE deck_id = ? AND user_id = ? ORDER BY (created_at DESC, id DESC)
-- Added before the cards_user_id_due_idx drop so the planner has continuous coverage.

CREATE INDEX IF NOT EXISTS cards_deck_pagination_idx
  ON cards (deck_id, created_at DESC, id DESC);


-- ─── 3. cards: add new-cards FIFO partial covering index ─────────────────────
-- Serves: get_due_cards new branch — WHERE user_id = ? AND state = 0
--   AND is_suspended = FALSE ORDER BY created_at ASC LIMIT remaining_new.

CREATE INDEX IF NOT EXISTS cards_user_new_creation_idx
  ON cards (user_id, created_at)
  WHERE state = 0 AND is_suspended = FALSE;


-- ─── 4. cards: drop superseded (user_id, due) index ──────────────────────────

DROP INDEX IF EXISTS cards_user_id_due_idx;


-- ─── 5. cards: drop unused GIN index on tags ─────────────────────────────────

DROP INDEX IF EXISTS cards_tags_gin_idx;


-- ─── 6. decks: add user+updated_at composite ─────────────────────────────────

CREATE INDEX IF NOT EXISTS decks_user_updated_idx
  ON decks (user_id, updated_at DESC);


-- ─── 7. decks: drop simple user_id index, now subsumed ───────────────────────

DROP INDEX IF EXISTS decks_user_id_idx;
