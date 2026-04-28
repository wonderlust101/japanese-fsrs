-- Adds 'manual' to the review_rating enum to support ts-fsrs Rating.Manual (= 0),
-- which is emitted by f.forget() and f.reschedule() in fsrs.service.ts.
-- ALTER TYPE ADD VALUE is irreversible in PostgreSQL without a full table rebuild.
-- IF NOT EXISTS makes this safe to re-run after `supabase db reset`.
ALTER TYPE review_rating ADD VALUE IF NOT EXISTS 'manual';
