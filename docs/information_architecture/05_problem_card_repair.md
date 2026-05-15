# Page Spec: Problem Card Repair

## Page Purpose

Problem Card Repair helps the learner improve cards that repeatedly fail. The goal is not to drill harder by default. The goal is to determine whether the card itself needs repair, then suggest a useful fix.

This page is where Tomo should feel like a teacher looking at the learner's material and saying: this card is costing you more effort than it should, here is how to make it better.

## Primary User Jobs

- See which cards need attention.
- Understand why a card may be failing.
- Accept or modify a suggested fix.
- Add missing support such as nuance, better sentence, mnemonic, or image.
- Suspend or simplify cards that are not worth the current effort.
- Optionally drill a card after it has been improved.

## Repair Philosophy

Do not start with drilling. Repeated failure may indicate a bad card, not weak memory. The sequence should be:

1. Detect repeated difficulty.
2. Diagnose the likely cause.
3. Suggest a fix.
4. Let the user confirm.
5. Offer optional drill after repair.

## Content Hierarchy

### Repair Queue

- Number of problem cards.
- Severity grouping.
- Likely issue for each card.
- Recommended next action.

### Repair Detail

- Card identity: expression, reading, meaning, context.
- Review signal: misses, lapses, retention issue.
- Likely cause.
- Suggested fix.
- Controls to apply, edit, skip, suspend, or open Card Detail.

## Severity Levels

### One-Off Miss

Let FSRS handle it. Do not bring the card into repair unless the user asks.

### Mid-Retention Issue

Diagnose and suggest one focused improvement. Examples: add contrast note, improve mnemonic, clarify meaning, use a better sentence.

### Low-Retention Issue

Use deeper repair. Teach the contrast, rewrite the card support, consider changing card type, and allow suspend.

### Leech-Like Behavior

Offer repair, simplify, split into multiple cards, or suspend. Do not frame suspension as failure.

## UX Notes

The repair flow should feel calm and efficient. Do not create a long tutoring session unless the card genuinely needs deep repair. Most mid-retention cards should be repairable with one good suggestion.

The learner should always see the current card content before accepting a fix. Trust depends on transparency.

## UI Notes

- Separate queue view from detail repair view.
- Use clear severity labels, but avoid alarming colors by default.
- Show “likely issue” in plain language.
- Make Apply change the primary action when a suggestion is strong.
- Make Skip easy. The user should not feel trapped in a repair workflow.
- Keep destructive or high-impact actions, such as suspend, visually serious but quiet.

## Common Repair Types

- Add contrast note for confusable words.
- Add or improve mnemonic.
- Replace vague sentence with clearer context.
- Add image.
- Add nuance note.
- Change card type.
- Split card into multiple smaller cards.
- Suspend temporarily.
- Move to a more appropriate deck.

## Interaction Notes

- Improve problem cards from Summary should open the repair queue filtered to that session.
- Problem Cards from Insights should open a broader repair queue.
- Applying a fix should show a short confirmation and move to the next card.
- After repair, offer “Drill this card now” as secondary, not primary.
- The user should be able to open full Card Detail at any point.

## Copy Tone

Use practical diagnosis, not blame. Example: “This may be failing because 開く and 開ける are too close without a contrast note.” Avoid: “You keep getting this wrong.”

## States

### Empty Repair Queue

Say there are no cards needing repair. Offer to return to Insights or Cards.

### Mid-Retention Repair

Show one likely cause and one suggested fix.

### Deep Repair

Show comparison, concept explanation, and multiple proposed field changes.

### Bulk Repair Candidates

If many cards share one issue, allow a batch suggestion, but require confirmation.

## Responsive Behavior

Desktop can support queue plus detail. Mobile should use a step-by-step flow with clear navigation between cards.

## Designer Watchouts

- Do not make repair feel like punishment.
- Do not ask the user to drill before determining whether the card is broken.
- Do not over-explain every card.
- Do not hide the original card content when suggesting changes.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
