-- =============================================================
-- Migration: 20260623000000_archive_aware_forecast_and_drill.sql
--
-- Extends the deck-archive freeze (migration 20260622000000) to two RPCs
-- that were left untouched in the original archive PR:
--
--   1. `get_review_forecast` — the forecast was still counting cards
--      from archived decks toward the daily projection, so the strip on
--      `/today` could promise reviews that `get_due_cards` then refused
--      to serve. Both RPCs now share the same archived-deck exclusion
--      shape (the `archived_decks` CTE + `NOT IN` filter pattern from
--      `get_due_cards` in migration 20260622000000).
--
--   2. `create_weak_spot_drill_session` — drill creation was happy to
--      build a session over weak spots whose underlying card sits in an
--      archived deck. The session would then be unactionable: every
--      attempt's downstream `processReview` call gets refused with
--      `DECK_ARCHIVED` because the deck-archive freeze already gates
--      that path. Filtering at the candidate-selection stage produces a
--      smaller (but useful) drill instead of a session that 422s on
--      every card.
--
-- Both changes are read-only; no data backfill, no destructive drops
-- beyond the standard `CREATE OR REPLACE` / re-`GRANT` pattern.
--
-- Cost: each RPC adds one `archived_decks AS (SELECT id …)` CTE. In the
-- typical case (zero archived decks) the planner short-circuits the
-- `NOT IN` to a no-op; with N archived decks the cost is one extra
-- index lookup on `decks(user_id) WHERE archived_at IS NOT NULL`, which
-- the partial index `decks_user_id_active_idx`'s complement covers.
-- =============================================================


-- ─── 1. get_review_forecast: exclude archived-deck cards ─────────────────────

CREATE OR REPLACE FUNCTION public.get_review_forecast(
  p_user_id               UUID,
  p_days                  INT  DEFAULT 14,
  p_timezone              TEXT DEFAULT 'UTC',
  p_daily_review_limit    INT  DEFAULT NULL,
  p_daily_new_cards_limit INT  DEFAULT NULL
)
RETURNS TABLE(
  date          TEXT,
  count         BIGINT,
  backlog_count BIGINT,
  review_count  BIGINT,
  new_count     BIGINT
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT
      DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) AS local_lo,
      DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) + (p_days || ' days')::INTERVAL AS local_hi
  ),
  -- Mirrors `get_due_cards` (migration 20260622000000): one targeted index
  -- lookup; planner short-circuits to no-op when the user has zero archived
  -- decks.
  archived_decks AS (
    SELECT id FROM public.decks
    WHERE user_id = p_user_id AND archived_at IS NOT NULL
  ),
  today_activity AS (
    SELECT
      COUNT(*)                                    AS total_today,
      COUNT(*) FILTER (WHERE rl.state_before = 0) AS new_today
    FROM public.review_logs rl, bounds b
    WHERE rl.user_id     = p_user_id
      AND rl.reviewed_at >= (b.local_lo AT TIME ZONE p_timezone)
  ),
  remaining AS (
    SELECT
      CASE
        WHEN p_daily_review_limit IS NULL THEN NULL::BIGINT
        ELSE GREATEST(0, p_daily_review_limit - total_today)::BIGINT
      END AS remaining_total,
      CASE
        WHEN p_daily_new_cards_limit IS NULL THEN NULL::BIGINT
        ELSE GREATEST(0, p_daily_new_cards_limit - new_today)::BIGINT
      END AS remaining_new
    FROM today_activity
  ),
  overdue_total AS (
    SELECT COUNT(*)::BIGINT AS n
    FROM public.cards c, bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        IN (1, 2, 3)
      AND c.due          < (b.local_lo AT TIME ZONE p_timezone)
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
  ),
  new_inventory AS (
    SELECT COUNT(*)::BIGINT AS n
    FROM public.cards c
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        = 0
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
  ),
  scheduled_per_day AS (
    SELECT
      TO_CHAR(c.due AT TIME ZONE p_timezone, 'YYYY-MM-DD') AS d,
      COUNT(*)::BIGINT                                     AS n
    FROM public.cards c, bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        IN (1, 2, 3)
      AND c.due         >= (b.local_lo AT TIME ZONE p_timezone)
      AND c.due          < (b.local_hi AT TIME ZONE p_timezone)
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
    GROUP BY 1
  ),
  per_day AS (
    SELECT
      idx,
      TO_CHAR((SELECT local_lo FROM bounds) + (idx || ' days')::INTERVAL, 'YYYY-MM-DD') AS d,
      COALESCE(spd.n, 0)::BIGINT AS scheduled
    FROM generate_series(0, p_days - 1) AS idx
    LEFT JOIN scheduled_per_day spd
      ON spd.d = TO_CHAR((SELECT local_lo FROM bounds) + (idx || ' days')::INTERVAL, 'YYYY-MM-DD')
  ),
  today_inputs AS (
    SELECT
      (SELECT n        FROM overdue_total)        AS overdue_n,
      (SELECT scheduled FROM per_day WHERE idx = 0) AS scheduled_today,
      (SELECT n        FROM new_inventory)        AS inventory_n,
      (SELECT remaining_total FROM remaining)      AS rem_total,
      (SELECT remaining_new   FROM remaining)      AS rem_new
  ),
  today_capped AS (
    SELECT
      CASE WHEN ti.rem_total IS NULL THEN ti.overdue_n
           ELSE LEAST(ti.overdue_n, ti.rem_total)
      END AS backlog_today
    FROM today_inputs ti
  ),
  today_with_review AS (
    SELECT
      tc.backlog_today,
      CASE WHEN ti.rem_total IS NULL THEN ti.scheduled_today
           ELSE LEAST(ti.scheduled_today, GREATEST(0, ti.rem_total - tc.backlog_today))
      END AS review_today,
      ti.*
    FROM today_capped tc, today_inputs ti
  ),
  today_with_new AS (
    SELECT
      twr.backlog_today,
      twr.review_today,
      CASE
        WHEN twr.rem_new IS NULL AND twr.rem_total IS NULL THEN twr.inventory_n
        WHEN twr.rem_total IS NULL THEN LEAST(twr.inventory_n, twr.rem_new)
        WHEN twr.rem_new   IS NULL THEN LEAST(
                                          twr.inventory_n,
                                          GREATEST(0, twr.rem_total - twr.backlog_today - twr.review_today)
                                        )
        ELSE LEAST(
               twr.inventory_n,
               twr.rem_new,
               GREATEST(0, twr.rem_total - twr.backlog_today - twr.review_today)
             )
      END AS new_today
    FROM today_with_review twr
  ),
  future_projection AS (
    SELECT
      pd.idx,
      pd.d,
      pd.scheduled AS review_n,
      GREATEST(
        0,
        LEAST(
          COALESCE(p_daily_new_cards_limit::BIGINT, (SELECT n FROM new_inventory)),
          (SELECT n FROM new_inventory)
            - (SELECT new_today FROM today_with_new)
            - (pd.idx - 1)::BIGINT * COALESCE(p_daily_new_cards_limit::BIGINT, 0)
        )
      )::BIGINT AS new_n
    FROM per_day pd
    WHERE pd.idx > 0
  ),
  combined AS (
    SELECT
      (SELECT d FROM per_day WHERE idx = 0) AS date,
      backlog_today                          AS backlog_count,
      review_today                           AS review_count,
      new_today                              AS new_count
    FROM today_with_new
    UNION ALL
    SELECT
      fp.d,
      0::BIGINT,
      fp.review_n,
      fp.new_n
    FROM future_projection fp
  )
  SELECT
    c.date,
    (c.backlog_count + c.review_count + c.new_count)::BIGINT AS count,
    c.backlog_count,
    c.review_count,
    c.new_count
  FROM combined c
  WHERE (c.backlog_count + c.review_count + c.new_count) > 0
  ORDER BY c.date;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_forecast(UUID, INT, TEXT, INT, INT) TO service_role;

COMMENT ON FUNCTION public.get_review_forecast(UUID, INT, TEXT, INT, INT) IS
  'Forecast horizon for the /today strip. Excludes cards in archived decks; mirrors get_due_cards (migration 20260622000000) so the two are arithmetically consistent.';


-- ─── 2. create_weak_spot_drill_session: exclude archived-deck cards ─────────

CREATE OR REPLACE FUNCTION public.create_weak_spot_drill_session(
  p_user_id       UUID,
  p_source        TEXT,
  p_deck_id       UUID,
  p_jlpt_level    TEXT,
  p_card_type     TEXT,
  p_order         TEXT,
  p_limit         INT,
  p_mode          TEXT,
  p_repeat_policy TEXT,
  p_stop_rule     JSONB,
  p_source_query  JSONB,
  p_card_ids      UUID[],
  p_card_id       UUID,
  p_min_lapses    INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id UUID;
  v_result     JSONB;
BEGIN
  INSERT INTO public.weak_spot_drill_sessions (
    user_id, source, source_query, mode, repeat_policy, stop_rule
  ) VALUES (
    p_user_id, p_source, p_source_query, p_mode, p_repeat_policy, p_stop_rule
  )
  RETURNING id INTO v_session_id;

  -- Archived-deck exclusion applies to all four branches. For deck_scoped /
  -- current_card the controller already 422s on an archived target, so the
  -- filter is a defense-in-depth no-op there. For unresolved_leeches /
  -- high_lapse_candidates / manual_selection the filter silently skips
  -- cards whose deck has been frozen — a smaller-but-actionable drill
  -- beats a session that 422s on every card the moment the user starts.
  WITH archived_decks AS (
    SELECT id FROM public.decks
    WHERE user_id = p_user_id AND archived_at IS NOT NULL
  ),
  candidate_rows AS (
    -- Branch A: unresolved_leeches + deck_scoped
    SELECT
      l.id                AS leech_id,
      l.created_at        AS leech_created_at,
      c.id                AS card_id,
      c.deck_id           AS card_deck_id,
      c.layout_type::text AS layout_type,
      c.card_type::text   AS card_type,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.weak_spots l
    JOIN public.cards   c ON c.id = l.card_id
    WHERE p_source IN ('unresolved_leeches', 'deck_scoped')
      AND l.user_id      = p_user_id
      AND l.resolved     = FALSE
      AND l.card_id IS NOT NULL
      AND c.is_suspended = FALSE
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)
      AND (p_card_type  IS NULL OR c.card_type::text  = p_card_type)

    UNION ALL

    -- Branch B: high_lapse_candidates
    SELECT
      NULL::UUID,
      NULL::TIMESTAMPTZ,
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.card_type::text,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.cards c
    WHERE p_source = 'high_lapse_candidates'
      AND c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.lapses >= COALESCE(p_min_lapses, 3)
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
      AND NOT EXISTS (
        SELECT 1 FROM public.weak_spots existing
         WHERE existing.card_id = c.id
           AND existing.user_id = p_user_id
           AND existing.resolved = FALSE
      )
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)
      AND (p_card_type  IS NULL OR c.card_type::text  = p_card_type)

    UNION ALL

    -- Branch C: manual_selection
    SELECT
      (SELECT existing.id
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS leech_id,
      (SELECT existing.created_at
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS leech_created_at,
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.card_type::text,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.cards c
    WHERE p_source = 'manual_selection'
      AND c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.id = ANY(p_card_ids)
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)

    UNION ALL

    -- Branch D: current_card. Controller already gated this with
    -- assertCardDeckActive; the NOT IN here is belt-and-braces.
    SELECT
      (SELECT existing.id
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1),
      (SELECT existing.created_at
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1),
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.card_type::text,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.cards c
    WHERE p_source = 'current_card'
      AND c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.id = p_card_id
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
  ),
  candidates AS (
    SELECT
      leech_id,
      leech_created_at,
      card_id,
      card_deck_id,
      layout_type,
      card_type,
      fields_data,
      state,
      due,
      stability,
      difficulty,
      elapsed_days,
      scheduled_days,
      learning_steps,
      reps,
      lapses,
      last_review,
      (row_number() OVER (
        ORDER BY
          CASE WHEN p_order = 'deckOrder'        THEN card_deck_id     END NULLS LAST,
          CASE WHEN p_order = 'oldestUnresolved' THEN leech_created_at END ASC  NULLS LAST,
          CASE WHEN p_order = 'mostLapses'       THEN lapses           END DESC NULLS LAST,
          CASE WHEN p_order IN ('mostRecent', 'deckOrder', 'mostLapses')
               THEN leech_created_at END DESC NULLS LAST,
          card_id DESC
      )) - 1 AS ordinal
    FROM candidate_rows
    LIMIT p_limit
  ),
  inserted AS (
    INSERT INTO public.weak_spot_drill_session_cards (
      session_id, card_id, leech_id, user_id, ordinal, source_reason,
      baseline_state, baseline_due, baseline_stability, baseline_difficulty,
      baseline_elapsed_days, baseline_scheduled_days, baseline_learning_steps,
      baseline_reps, baseline_lapses, baseline_last_review,
      canonical_state_fingerprint
    )
    SELECT
      v_session_id, cand.card_id, cand.leech_id, p_user_id, cand.ordinal,
      CASE
        WHEN p_source IN ('unresolved_leeches', 'deck_scoped') THEN 'unresolved_leech'
        WHEN p_source = 'high_lapse_candidates'                THEN 'high_lapse_candidate'
        WHEN p_source = 'manual_selection'                     THEN 'manual_selection'
        WHEN p_source = 'current_card'                         THEN 'current_card'
      END,
      cand.state, cand.due, cand.stability, cand.difficulty,
      cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
      cand.reps, cand.lapses, cand.last_review,
      public.compute_card_state_fingerprint_v1(
        cand.state, cand.due, cand.stability, cand.difficulty,
        cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
        cand.reps, cand.lapses, cand.last_review
      )
    FROM candidates cand
    ORDER BY cand.ordinal
    RETURNING id, leech_id, card_id, ordinal
  )
  SELECT jsonb_build_object(
    'sessionId', v_session_id,
    'status',    'active',
    'cards',     COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sessionCardId', i.id,
          'leechId',       i.leech_id,
          'cardId',        i.card_id,
          'ordinal',       i.ordinal,
          'layoutType',    cand.layout_type,
          'cardType',      cand.card_type,
          'fieldsData',    cand.fields_data,
          'lapses',        cand.lapses
        )
        ORDER BY i.ordinal
      )
      FROM inserted i
      JOIN candidates cand ON cand.card_id = i.card_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_weak_spot_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
) TO service_role;

COMMENT ON FUNCTION public.create_weak_spot_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
) IS
  'Builds a weak-spot drill session. Excludes cards whose deck is archived (migration 20260622000000); see also assertDeckActive / assertCardDeckActive at the controller layer for the deck_scoped / current_card hard-error paths.';
