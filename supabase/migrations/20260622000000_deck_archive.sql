-- =============================================================
-- Migration: 20260622000000_deck_archive.sql
--
-- Adds deck-level archive support.
--
-- Schema:
--   - `decks.archived_at TIMESTAMPTZ NULL`. Non-null timestamp = archived.
--     Carries the moment of the archive so the UI can show "archived 3
--     days ago" without a separate column.
--   - Partial index on `(user_id) WHERE archived_at IS NULL` to keep
--     the hot path (active decks) cheap. The full `(user_id)` index
--     already exists; this partial index just adds a smaller, cheaper
--     alternative that the planner will prefer for the default
--     `view = 'active'` listing.
--
-- Behavior (locked in by product decisions):
--   - `archived_at IS NOT NULL` excludes the deck from the default
--     `GET /api/v1/decks` listing (`?view=active`, the default).
--   - Cards belonging to archived decks are excluded from `/reviews/due`,
--     `/reviews/forecast`, and any mutation path that goes through
--     `process_review` / `process_review_batch`. The reviews RPCs are
--     not touched here — the service layer already pre-fetches the
--     target card row, so the archive check lives in TS in
--     `apps/api/src/services/fsrs.service.ts`. Keeping the heavy RPCs
--     un-touched avoids re-issuing the long `process_review_batch`
--     body and the security review that goes with it.
--   - Direct deck mutations (PATCH /:id, POST /:id/copy, archive,
--     unarchive, delete) and card mutations on archived decks are
--     gated at the service layer via an `assertDeckActive` helper.
--   - `DELETE /api/v1/decks/:id` continues to work on archived decks
--     — archive is a freeze, delete is the escape hatch.
--
-- RPC:
--   - `list_decks_paginated` gains `p_view TEXT DEFAULT 'active'`.
--     Accepted values: `'active'` (archived_at IS NULL — default),
--     `'archived'` (archived_at IS NOT NULL), `'all'` (no filter). The
--     `archived_at` column lands in `RETURNS TABLE` so the wire layer
--     can surface the timestamp without a second round-trip.
--   - DROP+CREATE because `RETURNS TABLE` and arg list both change;
--     PostgreSQL forbids in-place changes to either.
--   - `GRANT EXECUTE ... TO service_role` re-issued.
-- =============================================================


-- ─── 1. Column + index ───────────────────────────────────────────────────────

ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Partial index — the default listing is `view='active'` (archived_at IS NULL),
-- so a partial index on the user_id projection narrows the read cost on the
-- hot path. The pre-existing full index on (user_id) still covers the
-- 'archived' and 'all' paths.
CREATE INDEX IF NOT EXISTS decks_user_id_active_idx
  ON public.decks (user_id)
  WHERE archived_at IS NULL;


-- ─── 2. list_decks_paginated: add p_view + archived_at ───────────────────────

DROP FUNCTION public.list_decks_paginated(UUID, INT, UUID);

CREATE FUNCTION public.list_decks_paginated(
  p_user_id UUID,
  p_limit   INT,
  p_cursor  UUID  DEFAULT NULL,
  p_view    TEXT  DEFAULT 'active'
)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  description       TEXT,
  deck_type         public.deck_type,
  source_premade_id UUID,
  card_count        INT,
  version           INT,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  due_count         INT,
  new_count         INT,
  mature_count      INT,
  due_new_count     INT,
  due_review_count  INT,
  last_reviewed_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cursor_at TIMESTAMPTZ;
  v_view      TEXT := COALESCE(p_view, 'active');
BEGIN
  -- Defensive validation. The TS layer already rejects unknown values via
  -- a Zod enum, but the SQL function is a hard boundary too: a stray value
  -- should surface as a clean error instead of silently downgrading to
  -- 'all'.
  IF v_view NOT IN ('active', 'archived', 'all') THEN
    RAISE EXCEPTION 'invalid_view_filter'
      USING ERRCODE = '22023',
            HINT    = 'p_view must be one of: active, archived, all.';
  END IF;

  -- Resolve cursor → created_at. Scope to the caller so a foreign cursor
  -- silently degrades to "no cursor" rather than leaking deck existence.
  IF p_cursor IS NOT NULL THEN
    SELECT d.created_at INTO v_cursor_at
      FROM public.decks d
     WHERE d.id = p_cursor
       AND d.user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH page_decks AS (
    SELECT
      d.id                AS id,
      d.name              AS name,
      d.description       AS description,
      d.deck_type         AS deck_type,
      d.source_premade_id AS source_premade_id,
      d.card_count        AS card_count,
      d.version           AS version,
      d.created_at        AS created_at,
      d.updated_at        AS updated_at,
      d.archived_at       AS archived_at
    FROM public.decks d
    WHERE d.user_id = p_user_id
      AND (
        v_view = 'all'
        OR (v_view = 'active'   AND d.archived_at IS NULL)
        OR (v_view = 'archived' AND d.archived_at IS NOT NULL)
      )
      AND (
        v_cursor_at IS NULL
        OR (d.created_at, d.id) < (v_cursor_at, p_cursor)
      )
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT p_limit
  ),
  rollups AS (
    SELECT
      c.deck_id                                                                                       AS deck_id,
      COUNT(*) FILTER (WHERE c.due <= NOW() AND c.is_suspended = FALSE)                 ::INT          AS due_count,
      COUNT(*) FILTER (WHERE c.state = 0)                                               ::INT          AS new_count,
      COUNT(*) FILTER (WHERE c.state = 2 AND c.scheduled_days >= 21 AND c.is_suspended = FALSE)::INT   AS mature_count,
      COUNT(*) FILTER (WHERE c.due <= NOW() AND c.is_suspended = FALSE AND c.state = 0) ::INT          AS due_new_count,
      COUNT(*) FILTER (WHERE c.due <= NOW() AND c.is_suspended = FALSE AND c.state <> 0)::INT          AS due_review_count,
      MAX(c.last_review)                                                                              AS last_reviewed_at
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.deck_id IN (SELECT pd.id FROM page_decks pd)
    GROUP BY c.deck_id
  )
  SELECT
    pd.id,
    pd.name,
    pd.description,
    pd.deck_type,
    pd.source_premade_id,
    pd.card_count,
    pd.version,
    pd.created_at,
    pd.updated_at,
    pd.archived_at,
    COALESCE(r.due_count,        0) AS due_count,
    COALESCE(r.new_count,        0) AS new_count,
    COALESCE(r.mature_count,     0) AS mature_count,
    COALESCE(r.due_new_count,    0) AS due_new_count,
    COALESCE(r.due_review_count, 0) AS due_review_count,
    r.last_reviewed_at
  FROM page_decks pd
  LEFT JOIN rollups r ON r.deck_id = pd.id
  ORDER BY pd.created_at DESC, pd.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_decks_paginated(UUID, INT, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.list_decks_paginated(UUID, INT, UUID, TEXT) IS
  'Cursor-paginated decks list with per-deck rollups and an archive view '
  'filter. p_view accepts ''active'' (default), ''archived'', or ''all''.';


-- ─── 3. get_due_cards: exclude cards from archived decks ─────────────────────
--
-- The latest definition is in 20260614000000_drop_card_type.sql (DROP+CREATE
-- because RETURNS TABLE changed). The signature is unchanged here, so a
-- CREATE OR REPLACE suffices. Adds a single shared CTE that resolves the
-- caller's archived deck ids; both the `overdue` and `news` CTEs apply it
-- as a NOT IN filter. Same shape as `is_suspended = FALSE` — content is
-- silently elided from the queue rather than throwing.
--
-- Cost is a single index lookup on `decks(user_id) WHERE archived_at IS NOT
-- NULL`; in the typical case (0 archived decks) the planner short-circuits
-- the NOT IN to a no-op.

CREATE OR REPLACE FUNCTION public.get_due_cards(
  p_user_id               UUID,
  p_daily_review_limit    INT,
  p_daily_new_cards_limit INT,
  p_timezone              TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  id          UUID,
  deck_id     UUID,
  jlpt_level  public.jlpt_level,
  state       INT,
  due         TIMESTAMPTZ,
  fields_data JSONB,
  layout_type public.layout_type
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH today_bound AS (
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone AS lo
  ),
  -- Caller's archived deck ids. Resolved once and intersected against both
  -- the overdue and news pools. NULL-result-safe because both downstream
  -- filters use `NOT IN (subquery)` — when there are no archived decks the
  -- predicate evaluates to TRUE.
  archived_decks AS (
    SELECT id FROM public.decks
    WHERE user_id = p_user_id AND archived_at IS NOT NULL
  ),
  counts AS (
    SELECT
      COUNT(*)                                    AS total_today,
      COUNT(*) FILTER (WHERE rl.state_before = 0) AS new_today
    FROM public.review_logs rl, today_bound t
    WHERE rl.user_id = p_user_id
      AND rl.reviewed_at >= t.lo
  ),
  caps AS (
    SELECT
      GREATEST(0, p_daily_review_limit    - total_today)::INT AS remaining_total,
      GREATEST(0, p_daily_new_cards_limit - new_today)::INT   AS remaining_new
    FROM counts
  ),
  overdue AS (
    SELECT
      c.id, c.deck_id, c.jlpt_level,
      c.state, c.due, c.fields_data, c.layout_type,
      0 AS sort_bucket
    FROM public.cards c, caps
    WHERE c.user_id      = p_user_id
      AND c.state        IN (1, 2, 3)
      AND c.is_suspended = FALSE
      AND c.due         <= NOW()
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
      AND caps.remaining_total > 0
    ORDER BY c.due ASC
    LIMIT (SELECT remaining_total FROM caps)
  ),
  new_slots AS (
    SELECT
      GREATEST(
        0,
        LEAST(
          (SELECT remaining_new FROM caps),
          (SELECT remaining_total FROM caps) - (SELECT COUNT(*)::INT FROM overdue)
        )
      ) AS n
  ),
  news AS (
    SELECT
      c.id, c.deck_id, c.jlpt_level,
      c.state, c.due, c.fields_data, c.layout_type,
      1 AS sort_bucket
    FROM public.cards c, new_slots
    WHERE c.user_id      = p_user_id
      AND c.state        = 0
      AND c.is_suspended = FALSE
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
      AND new_slots.n > 0
    ORDER BY c.created_at ASC
    LIMIT (SELECT n FROM new_slots)
  )
  SELECT id, deck_id, jlpt_level, state, due, fields_data, layout_type
  FROM (
    SELECT * FROM overdue
    UNION ALL
    SELECT * FROM news
  ) ordered
  ORDER BY sort_bucket, due NULLS FIRST, id;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_cards(UUID, INT, INT, TEXT) TO service_role;
