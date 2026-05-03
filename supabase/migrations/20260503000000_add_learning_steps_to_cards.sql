-- Adds learning_steps to cards if it was absent from the initial schema.
--
-- ts-fsrs v5 tracks progress through (re)learning step sequences in this field.
-- Losing it between reviews resets a learning-phase card to step 0, which is
-- harmless but means the scheduler restarts the step sequence unnecessarily.
--
-- IF NOT EXISTS makes this safe to re-run on databases that already have the column.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS learning_steps INT NOT NULL DEFAULT 0;
