-- Composite index for status-based scheduling queries.
-- Companion to cards_user_id_due_idx (user_id, due) — covers queries like:
--   WHERE user_id = ? AND status IN ('learning', 'relearning')
--   WHERE user_id = ? AND status = 'suspended'
-- Without this, the planner falls back to the user_id slice and filters
-- status in memory.

CREATE INDEX IF NOT EXISTS cards_user_id_status_idx ON cards(user_id, status);
