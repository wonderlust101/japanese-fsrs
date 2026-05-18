-- =============================================================
-- Migration: 20260608000000_get_problem_cards_rpc.sql
--
-- Backend Completion Plan, Stage 7 — problem-card list, bucketed by
-- lapse count. Powers `GET /api/v1/insights/problem-cards?bucket=…`.
--
-- The `/insights/mistakes` page that originally consumed this endpoint
-- was retired in the 2026-05-17 IA restructure, but the data path still
-- has obvious downstream use (a `/cards` lapse-range saved view, a
-- future analytics surface, parity diagnostics against `/api/v1/leeches`),
-- so we ship the read-only endpoint per the plan and let a future PR
-- pick its consumer surface.
--
-- Bucket boundaries — sourced from IA doc `14_insights_mistakes.md`:
--   '2-3'    : lapses ∈ [2, 3]
--   '4-5'    : lapses ∈ [4, 5]
--   '6-7'    : lapses ∈ [6, 7]
--   '8plus'  : lapses ≥ 8 — the "leech zone." Counts in this bucket
--              equal the unresolved leech count for the same scope, since
--              process_review inserts an unresolved leech at lapses ≥
--              LEECH_THRESHOLD (default 8) and the partial unique index
--              leeches_card_user_unresolved_idx prevents duplicates.
--
-- Result ordering: `last_review DESC NULLS LAST, id DESC`. Cards reviewed
-- most recently come first so the consumer surface sees fresh data
-- without an explicit cursor. id is the tiebreaker — immutable, so the
-- order is stable across concurrent UPDATEs.
--
-- Suspended cards are excluded. Premade source cards (user_id IS NULL)
-- are excluded by the `c.user_id = p_user_id` filter — the function does
-- not need to defend against them explicitly.
--
-- Performance: at typical user scale (a few thousand cards), the
-- user-id-scoped scan with in-memory lapses filter is sub-millisecond.
-- No new index is warranted — the existing user-id-prefixed indexes
-- give the planner a small enough slice to chew through.
-- =============================================================

CREATE FUNCTION public.get_problem_cards(
  p_user_id UUID,
  p_bucket  TEXT
)
RETURNS TABLE (
  card_id     UUID,
  deck_id     UUID,
  layout_type public.layout_type,
  card_type   public.card_type,
  jlpt_level  public.jlpt_level,
  fields_data JSONB,
  state       INT,
  lapses      INT,
  reps        INT,
  due         TIMESTAMPTZ,
  last_review TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lo INT;
  v_hi INT;
BEGIN
  -- Resolve the bucket into a closed [lo, hi] range. `hi = NULL` is the
  -- open-ended (8+) case — the WHERE clause below switches on that.
  IF p_bucket = '2-3' THEN
    v_lo := 2; v_hi := 3;
  ELSIF p_bucket = '4-5' THEN
    v_lo := 4; v_hi := 5;
  ELSIF p_bucket = '6-7' THEN
    v_lo := 6; v_hi := 7;
  ELSIF p_bucket = '8plus' THEN
    v_lo := 8; v_hi := NULL;
  ELSE
    -- Defence in depth — the Zod layer at the controller rejects unknown
    -- values, but a direct-SQL caller could still slip one through. Raise
    -- with a recognisable SQLSTATE so the service layer can map cleanly.
    RAISE EXCEPTION 'invalid_problem_card_bucket' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    c.id          AS card_id,
    c.deck_id     AS deck_id,
    c.layout_type AS layout_type,
    c.card_type   AS card_type,
    c.jlpt_level  AS jlpt_level,
    c.fields_data AS fields_data,
    c.state       AS state,
    c.lapses      AS lapses,
    c.reps        AS reps,
    c.due         AS due,
    c.last_review AS last_review
  FROM public.cards c
  WHERE c.user_id      = p_user_id
    AND c.is_suspended = FALSE
    AND c.lapses       >= v_lo
    AND (v_hi IS NULL OR c.lapses <= v_hi)
  ORDER BY c.last_review DESC NULLS LAST, c.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_problem_cards(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.get_problem_cards(UUID, TEXT) IS
  'Backend Completion Plan Stage 7. Returns the user''s problem cards for
   one lapse bucket — 2-3, 4-5, 6-7, or 8plus (the leech zone). Excludes
   suspended cards. Ordered by last_review DESC NULLS LAST, id DESC. The
   8plus bucket cardinality equals the unresolved-leech count for the
   same scope (process_review inserts a leech at lapses >= LEECH_THRESHOLD).';
