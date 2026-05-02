-- Maintains decks.card_count atomically on card insert/delete.
-- Only fires for user-owned cards (deck_id IS NOT NULL).
-- Premade source cards have deck_id = NULL and are excluded.

CREATE OR REPLACE FUNCTION update_deck_card_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deck_id IS NOT NULL THEN
    UPDATE decks SET card_count = card_count + 1 WHERE id = NEW.deck_id;
  ELSIF TG_OP = 'DELETE' AND OLD.deck_id IS NOT NULL THEN
    UPDATE decks SET card_count = card_count - 1 WHERE id = OLD.deck_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER cards_count_trigger
  AFTER INSERT OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_deck_card_count();
