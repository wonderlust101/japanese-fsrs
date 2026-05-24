-- ─────────────────────────────────────────────────────────────────────────────
-- Folds the deck-archive review gate INTO the process_review RPC, removing
-- the pre-RPC round-trip the TS service layer used to make via
-- `getArchivedCardIds`. The single-review path goes from 2 round-trips
-- (archive check → RPC) to 1 (RPC includes the check).
--
-- DEPLOYMENT ORDERING (important — see CLAUDE.md):
--   This migration MUST land before the TS change that removes the pre-RPC
--   archive check. Reverse ordering would silently bypass the archive gate
--   between the TS deploy and the migration apply.
--
-- Migration body is a verbatim copy of the prior process_review definition
-- in 20260615000000_rename_leeches_to_weak_spots.sql (lines 66–174) with
-- exactly ONE addition: the archive guard immediately after the existing
-- premade-card guard. Diff the two files to verify no other drift.
--
-- SQLSTATE choice — 'P0420':
--   PostgreSQL reserves P00xx for PL/pgSQL conditions. The existing body
--   already uses 'no_data_found' (SQLSTATE P0002) for card_not_found, so
--   reusing P0002 here would prevent the TS error handler from
--   distinguishing the two cases. P0420 is a custom application code (the
--   '420' is mnemonic for the HTTP 422 response the TS layer maps it to)
--   that doesn't collide with anything in this codebase or in stdlib
--   PostgreSQL condition names.
--
-- The batch path (process_review_batch) is intentionally NOT touched here.
-- That path uses per-row error envelopes and a fundamentally different
-- error flow; folding archive into it is a separate, larger change.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_review(
  p_card_id              UUID,
  p_user_id              UUID,
  p_state                INT,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_elapsed_days         INT,
  p_scheduled_days       INT,
  p_learning_steps       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_last_review          TIMESTAMPTZ,
  p_updated_at           TIMESTAMPTZ,
  p_rating               review_rating,
  p_review_time_ms       INT,
  p_stability_after      FLOAT,
  p_difficulty_after     FLOAT,
  p_due_after            TIMESTAMPTZ,
  p_scheduled_days_after INT,
  p_leech_threshold      INT,
  p_state_before          INT         DEFAULT NULL,
  p_stability_before      FLOAT       DEFAULT NULL,
  p_difficulty_before     FLOAT       DEFAULT NULL,
  p_due_before            TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_days_before INT         DEFAULT NULL,
  p_learning_steps_before INT         DEFAULT NULL,
  p_elapsed_days_before   INT         DEFAULT NULL,
  p_last_review_before    TIMESTAMPTZ DEFAULT NULL,
  p_reps_before           INT         DEFAULT NULL,
  p_lapses_before         INT         DEFAULT NULL,
  p_session_id            UUID        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_owner UUID;
BEGIN
  -- Lock the row for the duration of this function. Concurrent process_review
  -- calls for the same card_id will block here until the first commits.
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified card does not exist.';
  END IF;

  IF v_card_owner IS NULL THEN
    RAISE EXCEPTION 'cannot_review_source_card'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'Submit reviews against your personal copy of this card, not the premade source.';
  END IF;

  IF v_card_owner != p_user_id THEN
    RAISE EXCEPTION 'card_ownership_mismatch'
      USING ERRCODE = 'insufficient_privilege',
            HINT    = 'The specified card does not belong to this user.';
  END IF;

  -- ── NEW (20260625000000) ─────────────────────────────────────────────────
  -- Archive gate: reject reviews on cards whose deck is archived.
  -- Single SQL, indexed via cards.deck_id → decks.id PK. Custom SQLSTATE
  -- 'P0420' lets the TS layer map this to a 422 DECK_ARCHIVED response
  -- distinct from the 'no_data_found' (P0002) card-not-found case above.
  IF EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.decks d ON d.id = c.deck_id
    WHERE c.id = p_card_id
      AND d.archived_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deck_archived'
      USING ERRCODE = 'P0420',
            HINT    = 'The deck containing this card is archived. Unarchive it before reviewing.';
  END IF;
  -- ── END NEW ──────────────────────────────────────────────────────────────

  UPDATE public.cards
  SET
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = p_elapsed_days,
    scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps,
    reps           = p_reps,
    lapses         = p_lapses,
    state          = p_state,
    last_review    = p_last_review,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO public.review_logs (
    card_id, user_id, rating, review_time_ms,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before, session_id
  ) VALUES (
    p_card_id, p_user_id, p_rating, p_review_time_ms,
    p_stability_after, p_difficulty_after, p_due_after, p_scheduled_days_after,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before, p_session_id
  );

  IF p_lapses >= p_leech_threshold THEN
    INSERT INTO public.weak_spots (card_id, user_id, session_id)
    SELECT p_card_id, p_user_id, p_session_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   public.weak_spots l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;
END;
$$;

-- Re-grant execute. The function-signature is identical to the prior
-- definition, so the prior GRANT is technically still in effect — but
-- CREATE OR REPLACE doesn't change existing privileges, and being explicit
-- here matches the convention used elsewhere in the migrations.
GRANT EXECUTE ON FUNCTION public.process_review(
  UUID, UUID, INT, TIMESTAMPTZ, FLOAT, FLOAT, INT, INT, INT, INT, INT,
  TIMESTAMPTZ, TIMESTAMPTZ, review_rating, INT, FLOAT, FLOAT, TIMESTAMPTZ,
  INT, INT, INT, FLOAT, FLOAT, TIMESTAMPTZ, INT, INT, INT, TIMESTAMPTZ,
  INT, INT, UUID
) TO service_role;
