# Page Spec: Card Detail

## Page Purpose

Card Detail is the deep inspection and editing surface for one card or note. It should let the learner understand the full learning object, edit its fields, inspect generated card types, review history, deck placement, scheduling status, and repair recommendations.

This page is essential because Tomo is not only a review app. It is a Japanese-tailored card quality system. The individual card is where card quality becomes visible.

## Primary User Jobs

- Inspect one card deeply.
- Edit expression, reading, meaning, sentence, translation, nuance, mnemonic, and image.
- Understand which card types are generated from the note.
- Change deck placement.
- View review history and scheduling information.
- Repair a weak card.
- Suspend or unsuspend the card.
- Open related cards or similar cards.

## Object Model Guidance

Tomo should distinguish between the underlying note and the cards generated from it.

A single Japanese note may produce:

- Vocabulary recognition card.
- Sentence understanding card.

(Reverse-direction "production" recall is a future render-time preference on the vocabulary layout, not a separately generated card — see `03_review_session.md`.)

Card Detail should make this relationship understandable without forcing the user into technical note-type terminology. Use plain language such as “Cards created from this item.”

## Content Hierarchy

### Primary Content

1. Expression and reading.
2. Meaning.
3. Sentence context and translation.
4. Card quality status.
5. Edit action.
6. Cards created from this item.

### Secondary Content

- Nuance note.
- Contrast note.
- Mnemonic.
- Image.
- Deck.
- JLPT level.
- Source.

### Advanced Content

- Review history.
- Scheduling state.
- FSRS-related information.
- Lapse history.
- Field completeness.
- Raw data or export format.

## UX Notes

Card Detail should be useful to both regular learners and power users. The regular learner should understand the card and edit obvious fields. The power user should be able to inspect scheduling and generated card types.

The page should not be a giant exposed form by default. Reading and inspecting the card should come before editing. Inline editing can work if it stays controlled, but the page should not visually imply that every field is equally important.

## UI Notes

- Treat the Japanese expression as the visual anchor.
- Group learning content separately from metadata.
- Use progressive disclosure for advanced scheduling information.
- Show missing important fields as card-quality suggestions, not as error states unless they block review.
- Make Edit, Repair, and Suspend accessible but distinct.
- Use tabs or sections if the page becomes dense.

## Suggested Sections

### Card Content

- Expression.
- Reading.
- Meaning.
- Sentence.
- Translation.
- Nuance.
- Contrast.
- Mnemonic.
- Image.

### Study Configuration

- Deck.
- Card types generated.
- JLPT level.
- Card status.
- Suspended state.

### Review History

- Last reviewed.
- Due date.
- Rating history.
- Lapses.
- Success pattern.
- Problem status.

### Scheduling Details

- Interval.
- Stability, difficulty, or retrievability if exposed.
- Desired retention context if useful.
- Explanation of what these values mean in plain language.

## Card Quality Guidance

Card Detail should help the learner improve the card without needing a separate repair flow every time.

Examples of quality suggestions:

- “This card has no sentence context.”
- “This card has repeated misses and no mnemonic.”
- “This expression is often confused with another card.”
- “The meaning may be too broad for the sentence.”
- “Reverse-direction recall is on, but the prompt may be ambiguous.”

Suggestions should be practical and actionable.

## Interaction Notes

- Edit opens editable fields or an edit mode.
- Forget and Reschedule are scheduling-repair actions in the card actions strip. Each opens a confirmation dialog and acts on this card in place (no separate route); the preview and history refresh without navigating away. Forget resets FSRS state and re-queues the card as new, with an opt-in to also zero lifetime counters; Reschedule replays the review log and recomputes the schedule. Both keep the review log.
- Open in Cards returns to the current filter/search context if available.
- Change deck should preserve review history unless the system behavior differs, in which case explain it.
- Suspend should require confirmation only if the impact is significant.
- Deleting should be intentionally harder than editing or suspending.

## Relationship to Cards Page

The Cards page is for search and bulk management. Card Detail is for deep understanding and editing one item. The transition between them should preserve context, especially active filters and search terms.

## Relationship to Weak spot repair

Scheduling repair (Forget / Reschedule) lives inline on Card Detail, not on a separate route. The broader Weak spot repair flow (diagnosis and content suggestions) remains an insights-driven surface; Card Detail surfaces a prominent inline prompt to reset scheduling when a card is repeatedly failing, and should show enough diagnostic information to explain why a reset is recommended.

## States

### Healthy Card

Show content and history without unnecessary warnings.

### Missing Support Field

Offer a suggestion but do not block normal use.

### Repeatedly Missed Card

Show problem status and repair action prominently.

### Suspended Card

Make suspended status visible and allow unsuspend.

### Multiple Generated Cards

Show which card types exist and how they perform individually.

## Responsive Behavior

Desktop can support content plus side metadata. Mobile should prioritize card content first, then actions, then metadata. Avoid making mobile users scroll past technical data before seeing the card.

## Copy Tone

Use clear card-quality language. Avoid blaming the learner. The card may be the problem, not the user.

## Designer Watchouts

- Do not hide generated card types.
- Do not make advanced scheduling values the first thing users see.
- Do not force every edit through a separate page if inline editing can be clear.
- Do not bury repair when the card is repeatedly failing.
- Do not treat all fields as equally important.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
