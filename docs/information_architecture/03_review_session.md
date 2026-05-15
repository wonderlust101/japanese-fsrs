# Page Spec: Review Session

## Page Purpose

Review Session is the core practice mode. It should feel focused, quiet, and instrument-like. The learner is here to recall, reveal, rate, and continue. Everything that does not support that rhythm should be hidden, delayed, or removed.

The session should support three launch card types: vocabulary recognition, sentence understanding, and production. Each card type tests a different memory direction and must have a different content hierarchy.

## Primary User Jobs

- Focus on one card at a time.
- Recall the answer without hints.
- Reveal the answer.
- Rate the card using Again, Hard, Good, or Easy.
- Move through reviews efficiently by keyboard or touch.
- Pause, exit, edit, or suspend only when needed.
- Trust that progress is saved, including during offline review.

## Core Design Direction

Use a large centered card with minimal surrounding UI. The Japanese content should be visually dominant. Chrome should be quiet. Metadata should be hidden by default.

No hint system should be included in the launch review UI. The sentence context is already the natural cue. Adding a Hint button risks encouraging dependency and making retention data less honest.

## Card Type Content Hierarchy

### Vocabulary Recognition

Purpose: test whether the learner understands the Japanese expression.

Before reveal, show the Japanese expression and sentence context. Audio may be available if the card includes it. Do not show the English definition before reveal.

After reveal, show reading, meaning, sentence translation, nuance, and any memory-support content that is part of the card.

### Sentence Understanding

Purpose: test whether the learner understands the sentence and target expression in context.

Before reveal, prioritize the Japanese sentence. Avoid over-highlighting the target word unless testing shows learners need it. After reveal, show translation, target expression, reading, meaning, and a concise explanatory note.

### Production

Purpose: test whether the learner can produce the Japanese from an English prompt.

Before reveal, show the English meaning and context prompt. Do not show the Japanese expression before reveal. After reveal, show the Japanese expression, reading, sentence, translation, and nuance.

## Rating System

Use the four Anki-compatible labels:

- Again
- Hard
- Good
- Easy

Keyboard support should map to 1, 2, 3, and 4. Space or Enter should reveal the answer. Escape should pause or open the session menu.

Intervals may be shown as an advanced display preference. Default mode can hide intervals to reduce overthinking. Advanced mode can show next intervals on the rating buttons for Anki-like users.

## UX Notes

The session is not the place for teaching long explanations. It is the place for practice. Teaching belongs mainly in the answer reveal, review summary, problem card repair, and insights.

AI-generated explanations should not appear automatically after every mistake. That would break the review rhythm. If the user repeatedly fails a card, mark it for Summary or Problem Card Repair.

## UI Notes

- Keep the review card visually centered and spacious.
- Use clear reveal and rating states.
- Make rating buttons large enough for confident selection.
- Keep metadata behind an overflow or details control.
- Avoid side panels by default. A side panel can exist in desktop advanced mode, but it should not be the default review experience.
- On mobile, rating buttons should be thumb-friendly and persistent after reveal.

## Metadata Policy

Hidden by default:

- Deck
- Tags
- Card type
- JLPT level
- Source
- Last reviewed
- Lapse count
- Scheduling details
- FSRS state

Accessible through a More menu:

- Card details
- Edit card
- Suspend card
- Report issue
- View scheduling info

## Interaction Notes

- The reveal interaction should be immediate and predictable.
- Rating should advance to the next card without extra confirmation.
- Undo should be available, but not visually dominant.
- Edit and Suspend should be available from the More menu.
- Offline review should show quiet reassurance when needed.
- Session progress should be visible but not attention-grabbing.

## States

### Before Reveal

Focus on the prompt and context. Do not include answer material.

### After Reveal

Show the answer and rating buttons. The rating buttons become the primary interactive area.

### Paused

Pause state should allow resume, end session, or return to Today. Make clear whether progress is saved.

### Offline

Use reassurance, not technical queue language. Make it clear that progress is saved locally.

### Error During Session

Preserve user trust. Explain whether the current rating was saved and what action is needed.

## Responsive Behavior

Desktop should support keyboard-first review and large visual focus. Mobile should support one-handed review, large rating buttons, and minimal top chrome. Do not force desktop density onto mobile.

## Copy Tone

Keep review copy minimal. This is not a chatty surface. The product should feel present, not talkative.

## Designer Watchouts

- Do not add hints.
- Do not show definitions before reveal on recognition cards.
- Do not show Japanese before reveal on production cards.
- Do not make the review card visually compete with navigation.
- Do not add teaching panels that interrupt the rating loop.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
