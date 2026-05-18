# Page Spec: Deck Preview

## Page Purpose

Deck Preview lets learners inspect a premade deck before adding it to their library. This page builds trust. Serious SRS users care deeply about card quality and review load, so asking them to add hundreds of cards blindly is not acceptable.

> **Interaction model (recorded 2026-05-17):** Adding a premade deck is a *copy*, not a subscription. The user gets a fully owned, standalone deck — no ongoing link to the source, no version updates, no sync. To refresh content from a newer version of the premade deck, the user deletes their deck and adds it again, paying the FSRS-progress cost explicitly. Duplicate copies are allowed. Backend contract: `POST /api/v1/premade-decks/:id/copy`. See [DATABASE.md](../DATABASE.md) "Premade decks are a starting point, not a strict path" and the Backend Completion Plan Stage 4 entry in [KANBAN_BOARD.md](../KANBAN_BOARD.md).

## Primary User Jobs

- Understand what the deck covers.
- Inspect sample cards.
- See card count and card types.
- Understand JLPT or proficiency scope.
- Estimate review load.
- Understand included fields such as audio, image, sentence, nuance, and mnemonic.
- Add the deck to their library with controlled defaults.

## Content Hierarchy

### Primary Content

1. Deck title and scope.
2. Card count and level.
3. Sample cards.
4. Estimated workload.
5. "Add to my library" action.

### Secondary Content

- Included fields.
- Card type breakdown.
- Tags or topics.
- Creator or source, if relevant.
- Last updated.
- Preview more cards.

### Advanced Content

- Import options.
- New cards per day.
- Pause new cards on add.
- Add selected cards only.
- Compare with existing decks.

## UX Notes

Deck Preview is a trust-building page. It should help the learner answer: "Do I want hundreds of these cards in my account?"

The page should avoid salesy presentation. Premade decks are study material, not marketplace products. The page should emphasize card quality, relevance, and workload.

The page should also make clear that adding a deck is a one-time copy — the deck becomes the learner's own, editable, and independent of the source.

## UI Notes

- Show sample cards early, not hidden at the bottom.
- Present estimated workload in plain language.
- Make the "Add to my library" settings visible before committing.
- Use clear labels for card types and included fields.
- Avoid oversized promotional hero sections that delay inspection.

## Recommended Data

- Deck name.
- Description.
- JLPT level or scope.
- Number of notes and cards.
- Card type breakdown.
- Included fields.
- Sample cards.
- Estimated daily review time.
- Recommended new cards per day.
- Last updated.
- Compatibility notes, if needed.

## Add-to-Library Options

Recommended options:

- Add with recommended new-card limit.
- Add but pause new cards.
- Preview more cards.
- Add selected cards only.
- Change daily new-card limit before adding.

The primary action should be specific. "Add 5 new cards/day to my library" is better than "Add."

## Interaction Notes

- Sample cards should show enough information to judge quality.
- Preview more cards should not require adding the deck.
- Changing new-card limit should update workload estimate.
- After adding, show where the deck was added and what happens next.
- If deck overlaps with existing cards, explain duplication handling.
- Adding the same premade deck twice is allowed and produces two independent decks; the UI should not silently block this, but a soft confirmation ("You already have a copy of this deck. Add another?") is acceptable to prevent accidental clicks.

## States

### Normal Preview

Shows deck information, samples, and the "Add to my library" controls.

### Already in Library

The learner already has at least one copy. Show that status, link to the existing copy (or list copies if there are several), and offer "Add another copy" with a soft confirmation. Do not block — the user may want a fresh start without losing the in-progress copy.

### Overlap Detected

Explain that some cards in the premade deck appear similar to cards already in the learner's library, and offer to add anyway or filter overlapping cards out.

### Large Deck

Emphasize controlled workload and the daily new-card limit.

### Missing Samples

Do not allow a premade deck to feel opaque. If samples are unavailable, explain why or block publication.

## Responsive Behavior

Desktop can show deck metadata and samples side by side. Mobile should prioritize title, sample cards, workload estimate, and the add-to-library settings.

## Copy Tone

Use honest study-material language. Avoid marketing exaggeration. Make the one-shot nature of adding the deck clear without being alarmist — "Your copy" rather than "permanent fork".

## Designer Watchouts

- Do not hide sample cards.
- Do not use vague "Add" copy — be specific about how many cards and at what daily pace.
- Do not bury review-load consequences.
- Do not make premade decks feel like ads.
- Do not commit hundreds of cards without control.
- Do not imply an ongoing relationship to the source deck (no "synced", "subscribed", "up to date" language) — the copy is the learner's own once added.

## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
