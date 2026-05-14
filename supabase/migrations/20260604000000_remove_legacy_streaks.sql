-- =============================================================
-- Migration: 20260604000000_remove_legacy_streaks.sql
--
-- Stage 8 — removes the legacy streak surface end-to-end.
--
-- Background: streaks have been "intentionally deferred from the
-- current dashboard and analytics scope" per docs/KANBAN_BOARD.md
-- since the analytics surface was redesigned. The legacy
-- get_streak() RPC and its bundled inclusion in get_dashboard_data
-- have lingered as dead weight. Stage 8 removes both. The frontend
-- StreakCard component and useStreak hook are dropped in the same
-- commit; this migration is the SQL half.
--
-- This migration does NOT drop the supporting index
-- `review_logs_user_id_reviewed_at_idx` — heatmap and accuracy
-- queries still use it. The index stays; only the streak-specific
-- function goes.
--
-- §A  CREATE OR REPLACE get_dashboard_data without the 'streak' key.
--     Every other key (heatmap, accuracy, jlpt_gap, milestones) is
--     preserved byte-for-byte from the prior definition.
--
-- §B  DROP FUNCTION get_streak(uuid). Safe because the only callers
--     were (1) the now-replaced get_dashboard_data above and (2) the
--     /api/v1/analytics/streak route which Stage 8's code removal
--     deletes.
--
-- BREAKING CHANGE on the wire contract: the bundled dashboard
-- response no longer carries `streak`. The shared-types schema and
-- frontend consumers are updated in the same commit. See the
-- accompanying code changes.
-- =============================================================


-- ─── §A. Replace get_dashboard_data without streak ────────────────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'heatmap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'date',      h.date,
         'retention', h.retention,
         'count',     h.count
       ))
       FROM public.get_heatmap_data(p_user_id) AS h),
      '[]'::jsonb
    ),
    'accuracy', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'layout',     a.layout,
         'total',      a.total,
         'successful', a.successful
       ))
       FROM public.get_accuracy_by_layout(p_user_id) AS a),
      '[]'::jsonb
    ),
    'jlpt_gap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'jlpt_level', g.jlpt_level,
         'total',      g.total,
         'learned',    g.learned,
         'due',        g.due
       ))
       FROM public.get_jlpt_gap(p_user_id) AS g),
      '[]'::jsonb
    ),
    'milestones', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'jlpt_level',                m.jlpt_level,
         'total',                     m.total,
         'learned',                   m.learned,
         'daily_pace',                m.daily_pace,
         'days_remaining',            m.days_remaining,
         'projected_completion_date', m.projected_completion_date
       ))
       FROM public.get_milestone_forecast(p_user_id) AS m),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_data(UUID) TO service_role;


-- ─── §B. Drop the get_streak function ─────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_streak(UUID);
