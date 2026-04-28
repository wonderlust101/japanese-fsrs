-- Adds before-snapshot columns to review_logs.
--
-- Required for rollbackReview() in fsrs.service.ts: ts-fsrs f.rollback(card, log)
-- needs the full pre-review card state to reconstruct where the card was before
-- the review was applied.
--
-- All columns are nullable — rows written before this migration have NULLs and
-- are not eligible for rollback. rollbackReview() enforces this with a 409 guard.
ALTER TABLE review_logs
  ADD COLUMN IF NOT EXISTS state_before          INT,
  ADD COLUMN IF NOT EXISTS stability_before      FLOAT,
  ADD COLUMN IF NOT EXISTS difficulty_before     FLOAT,
  ADD COLUMN IF NOT EXISTS due_before            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_days_before INT,
  ADD COLUMN IF NOT EXISTS learning_steps_before INT,
  ADD COLUMN IF NOT EXISTS elapsed_days_before   INT,
  ADD COLUMN IF NOT EXISTS last_review_before    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reps_before           INT,
  ADD COLUMN IF NOT EXISTS lapses_before         INT;
