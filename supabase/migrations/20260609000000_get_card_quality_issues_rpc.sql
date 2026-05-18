-- =============================================================
-- Migration: 20260609000000_get_card_quality_issues_rpc.sql
--
-- Backend Completion Plan Stage 8 — Card-quality issue counts.
-- Powers `GET /api/v1/insights/card-quality`, which feeds the
-- card-health distribution strip on /cards.
--
-- Six issue types are surfaced per user, all derived from
-- `fields_data` JSONB key presence + emptiness on vocabulary and
-- grammar layouts:
--
--   missing_reading   — fields_data->>'reading' is NULL or ''
--   missing_meaning   — fields_data->>'meaning' is NULL or ''
--   missing_example   — exampleSentences key missing, not an array,
--                       or an empty array
--   missing_mnemonic  — fields_data->>'mnemonic' is NULL or ''
--   missing_picture   — fields_data->>'picture' is NULL or ''
--                       (admitted on WordFieldsSchema by Stage 1; will
--                        be zero until the v4 review UI starts producing
--                        the field)
--   missing_nuance    — fields_data->>'nuance' is NULL or ''
--                       (same Stage 1 dependency as picture)
--
-- Sentence-layout cards are excluded — their fields_data shape is
-- intentionally open and doesn't carry these keys. Premade source
-- rows are excluded by the c.user_id = p_user_id filter.
--
-- Performance: one scan of the user's vocabulary/grammar cards.
-- Six COUNT(*) FILTER aggregates run side-by-side under a single
-- HashAggregate node, then LATERAL VALUES unpivots into six output
-- rows. A naive UNION ALL of six aggregates would scan the slice six
-- times — same wire shape, sixfold the I/O.
--
-- The aggregates fire in one pass over a small user-scoped slice
-- (typical scale: a few thousand cards). No new index needed; the
-- existing user_id-prefixed indexes give the planner a focused start.
-- =============================================================

CREATE FUNCTION public.get_card_quality_issues(
  p_user_id UUID
)
RETURNS TABLE (
  issue_type TEXT,
  count      INT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT
      COUNT(*) FILTER (
        WHERE c.fields_data ->> 'reading' IS NULL
           OR c.fields_data ->> 'reading' = ''
      )::INT AS missing_reading,
      COUNT(*) FILTER (
        WHERE c.fields_data ->> 'meaning' IS NULL
           OR c.fields_data ->> 'meaning' = ''
      )::INT AS missing_meaning,
      COUNT(*) FILTER (
        -- jsonb_array_length raises on a non-array value; the jsonb_typeof
        -- guard makes this robust to any historical / hand-edited cards
        -- whose `exampleSentences` value drifted from the schema.
        WHERE NOT (c.fields_data ? 'exampleSentences')
           OR jsonb_typeof(c.fields_data -> 'exampleSentences') <> 'array'
           OR jsonb_array_length(c.fields_data -> 'exampleSentences') = 0
      )::INT AS missing_example,
      COUNT(*) FILTER (
        WHERE c.fields_data ->> 'mnemonic' IS NULL
           OR c.fields_data ->> 'mnemonic' = ''
      )::INT AS missing_mnemonic,
      COUNT(*) FILTER (
        WHERE c.fields_data ->> 'picture' IS NULL
           OR c.fields_data ->> 'picture' = ''
      )::INT AS missing_picture,
      COUNT(*) FILTER (
        WHERE c.fields_data ->> 'nuance' IS NULL
           OR c.fields_data ->> 'nuance' = ''
      )::INT AS missing_nuance
    FROM public.cards c
    WHERE c.user_id     = p_user_id
      AND c.layout_type IN ('vocabulary', 'grammar')
  )
  -- Always emit all six rows, even when every count is zero. Frontend
  -- consumers can iterate a stable shape without conditionally handling
  -- "this issue type is missing from the response."
  SELECT v.issue_type, v.count
  FROM counts cc,
  LATERAL (VALUES
    ('missing_reading'::TEXT,  cc.missing_reading),
    ('missing_meaning'::TEXT,  cc.missing_meaning),
    ('missing_example'::TEXT,  cc.missing_example),
    ('missing_mnemonic'::TEXT, cc.missing_mnemonic),
    ('missing_picture'::TEXT,  cc.missing_picture),
    ('missing_nuance'::TEXT,   cc.missing_nuance)
  ) AS v(issue_type, count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_card_quality_issues(UUID) TO service_role;

COMMENT ON FUNCTION public.get_card_quality_issues(UUID) IS
  'Backend Completion Plan Stage 8. Returns six rows of issue_type +
   count derived from fields_data JSONB key presence on vocabulary and
   grammar cards. missing_picture and missing_nuance counts can be
   non-zero only after Stage 1 (Lapis fields) lands on the AI generator
   path — older cards never carry those keys.';
