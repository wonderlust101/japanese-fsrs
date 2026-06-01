-- Raise the global FSRS retention default from 0.85 to 0.88.
--
-- The single scheduler in apps/api/src/services/fsrs/shared.ts now runs at
-- request_retention = 0.88 (gentler stability ramp; see that file's comment).
-- profiles.retention_target is the documented global default that mirrors the
-- scheduler constant and is surfaced to users on the Statistics page, so it
-- must move in lockstep or the UI will report a target the scheduler does not
-- actually use.
--
-- Two parts:
--   1. Change the column DEFAULT so new profiles seed at 0.88.
--   2. Backfill existing rows that still hold the *old default* (0.85) to 0.88.
--      We only touch rows at exactly 0.85 to avoid stomping any value a user
--      deliberately chose. (Scheduling is global today regardless of this
--      column, so this is purely keeping the displayed/stored target honest.)
--
-- The CHECK constraint (retention_target > 0 AND retention_target <= 1) already
-- admits 0.88; no constraint change needed. RLS is unaffected by an ALTER
-- DEFAULT / bounded UPDATE.

ALTER TABLE public.profiles
  ALTER COLUMN retention_target SET DEFAULT 0.88;

UPDATE public.profiles
  SET retention_target = 0.88
  WHERE retention_target = 0.85;
