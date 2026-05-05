-- ============================================================
-- Migration: 20260512000000_card_count_trigger_search_path.sql
--
-- Two unrelated 42xxx failures surfaced together; fixing both here
-- so the dev cycle clears in one push.
--
-- 1. update_deck_card_count() — 42P01
--    subscribe_to_premade_deck (SECURITY DEFINER, search_path = '')
--    inserts into public.cards, which fires cards_count_trigger →
--    update_deck_card_count(). The trigger function has no SET
--    search_path of its own, so it inherits '' from the caller and
--    the unqualified `decks` / `premade_decks` references fail with
--    42P01: relation "decks" does not exist.
--
--    Fix: pin search_path = '' on the trigger function and fully
--    qualify the table references with public.* — same pattern as
--    set_updated_at() in 20260504000008.
--
-- 2. get_heatmap_data() — 42804
--    Function declares retention FLOAT, but the body produces
--    ROUND(numeric, 1) which returns NUMERIC. Under LANGUAGE plpgsql
--    + RETURN QUERY the implicit cast is rejected:
--    "Returned type numeric does not match expected type double
--    precision in column 2".
--
--    Fix: cast the ROUND result to FLOAT. Same shape as the
--    daily_pace fix in 20260505000000.
-- ============================================================

CREATE OR REPLACE FUNCTION update_deck_card_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deck_id IS NOT NULL THEN
      UPDATE public.decks         SET card_count = card_count + 1 WHERE id = NEW.deck_id;
    ELSIF NEW.premade_deck_id IS NOT NULL THEN
      UPDATE public.premade_decks SET card_count = card_count + 1 WHERE id = NEW.premade_deck_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deck_id IS NOT NULL THEN
      UPDATE public.decks         SET card_count = card_count - 1 WHERE id = OLD.deck_id;
    ELSIF OLD.premade_deck_id IS NOT NULL THEN
      UPDATE public.premade_decks SET card_count = card_count - 1 WHERE id = OLD.premade_deck_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_heatmap_data(p_user_id UUID)
RETURNS TABLE(date TEXT, retention FLOAT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(rl.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')  AS date,
    ROUND(
      (COUNT(*) FILTER (WHERE rl.rating IN ('good', 'easy'))::NUMERIC
      / COUNT(*) * 100),
      1
    )::FLOAT                                                   AS retention,
    COUNT(*)                                                   AS count
  FROM public.review_logs rl
  WHERE rl.user_id    = p_user_id
    AND rl.reviewed_at >= NOW() - INTERVAL '365 days'
  GROUP BY TO_CHAR(rl.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  ORDER BY date;
END;
$$;
