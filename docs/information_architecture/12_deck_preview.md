# Page Spec: Deck Preview

## Page Purpose

Deck Preview lets learners inspect a premade deck before subscribing or importing. This page builds trust. Serious SRS users care deeply about card quality and review load, so asking them to subscribe blindly is not acceptable.

## Primary User Jobs

- Understand what the deck covers.
- Inspect sample cards.
- See card count and card types.
- Understand JLPT or proficiency scope.
- Estimate review load.
- Understand included fields such as audio, image, sentence, nuance, and mnemonic.
- Subscribe with controlled defaults.

## Content Hierarchy

### Primary Content

1. Deck title and scope.
2. Card count and level.
3. Sample cards.
4. Estimated workload.
5. Subscribe action.

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
- Pause after subscribing.
- Subscribe selected cards only.
- Compare with existing decks.

## UX Notes

Deck Preview is a trust-building page. It should help the learner answer: “Do I want hundreds of these cards in my account?”

The page should avoid salesy presentation. Premade decks are study material, not marketplace products. The page should emphasize card quality, relevance, and workload.

## UI Notes

- Show sample cards early, not hidden at the bottom.
- Present estimated workload in plain language.
- Make subscription settings visible before committing.
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

## Subscription Options

Recommended options:

- Subscribe with recommended new-card limit.
- Subscribe but pause new cards.
- Preview more cards.
- Add selected cards.
- Change daily new-card limit before subscribing.

The primary action should be specific. “Subscribe with 5 new cards/day” is better than “Subscribe.”

## Interaction Notes

- Sample cards should show enough information to judge quality.
- Preview more cards should not require subscription.
- Changing new-card limit should update workload estimate.
- After subscribing, show where the deck was added and what happens next.
- If deck overlaps with existing cards, explain duplication handling.

## States

### Normal Preview

Shows deck information, samples, and subscribe controls.

### Already Subscribed

Show subscribed status and actions to open deck or adjust options.

### Overlap Detected

Explain duplicates and offer safe import behavior.

### Large Deck

Emphasize controlled subscription and review load.

### Missing Samples

Do not allow a premade deck to feel opaque. If samples are unavailable, explain why or block publication.

## Responsive Behavior

Desktop can show deck metadata and samples side by side. Mobile should prioritize title, sample cards, workload estimate, and subscription settings.

## Copy Tone

Use honest study-material language. Avoid marketing exaggeration.

## Designer Watchouts

- Do not hide sample cards.
- Do not use vague Subscribe copy.
- Do not bury review-load consequences.
- Do not make premade decks feel like ads.
- Do not commit hundreds of cards without control.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
