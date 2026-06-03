# Page Spec: Generated Card Review

## Page Purpose

Generated Card Review lets the learner confirm and correct the card before it enters the review system. The page should make the most important corrections easy: meaning, card types, deck placement, and learning support.

This page is not a raw form. It is a review and correction surface. The user should feel that Tomo has prepared a strong card, while still giving them final control.

## Primary User Jobs

- Confirm the selected meaning.
- Choose the card types to create.
- Review expression, reading, sentence, translation, and nuance.
- Regenerate or edit example and mnemonic.
- Add image if useful.
- Assign or change deck.
- Save the created cards.

## Content Hierarchy

### Primary Content

1. Expression and reading.
2. Selected meaning.
3. Sentence context and translation.
4. Cards to create.
5. Save action.

### Secondary Content

- Nuance note.
- Contrast note.
- Example sentence.
- Mnemonic.
- Image.
- Deck placement.

### Advanced Content

- Pitch accent.
- Frequency.
- Raw fields.
- Scheduling details.
- Card template flags.

## Default Card Creation

The default should be one note producing two cards:

- Vocabulary recognition.
- Sentence understanding.

Reverse-direction (production-style) recall is a future per-user display preference applied on top of the vocabulary layout — not a separately generated card (see `03_review_session.md`).

The save action should make the review-load impact visible. Use copy such as “Save 2 cards” instead of a generic “Save.”

## Meaning Uncertainty

When the word has multiple common meanings, show multiple possible meanings and ask the user to choose the one matching the sentence.

Avoid saying “AI is uncertain.” Prefer: “This word has a few common meanings. Choose the one that matches your sentence.”

## Corrections by Priority

### Highest Priority

- Change selected meaning.
- Choose card types to create.
- Change card type.

### High Priority

- Move to another deck.
- Regenerate example.
- Regenerate mnemonic.

### Medium Priority

- Add image.
- Edit reading.
- Edit sentence translation.
- Edit nuance note.

### Advanced Priority

- Pitch accent.
- Frequency.
- Raw template fields.

## UX Notes

The page must reduce the risk of poison cards. A card with the wrong meaning is worse than no card. Therefore, meaning confirmation deserves higher priority than decorative support fields.

At the same time, the page should not feel like a laborious review form. The learner should only be asked to intervene where the generated card is ambiguous, incomplete, or personally important.

## UI Notes

- Highlight the selected meaning and make changing it easy.
- Present card type selection clearly, including how many cards will be saved.
- Treat deck selection as important but not the main focus.
- Show learning support fields in a calm secondary area.
- Avoid equal visual weight for every field.
- Use progressive disclosure for advanced metadata.

## Save-Blocking Rules

Strongly block or warn when:

- Multiple meanings exist and no meaning is selected.
- The sentence context does not contain the target expression.
- The generated meaning conflicts with the sentence.
- The reading cannot be determined for a kanji expression.
- The card lacks a usable definition.

Allow saving when missing:

- Image.
- Mnemonic.
- Source.
- Pitch accent.
- Extra example.

## Interaction Notes

- Change meaning opens a compact sense picker.
- Regenerate example should preserve the selected meaning.
- Regenerate mnemonic should preserve expression and context.
- Move deck should offer recent decks and search.
- Save should confirm how many cards were created and where they were placed.
- After save, offer Add another, Open card detail, or Return to Today.

## Responsive Behavior

Desktop can show a richer review layout with preview and fields visible together. Mobile should use a stepped hierarchy: confirm meaning, choose cards, review support, save.

## Copy Tone

Be transparent without sounding technical. Use practical, teacher-like copy that describes the learning object, not the generation mechanism.

## Designer Watchouts

- Do not bury meaning selection.
- Do not make every generated field look equally important.
- Do not use visible AI branding.
- Do not save multiple cards without showing the count.
- Do not force advanced fields into the default flow.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
