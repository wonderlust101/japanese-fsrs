# Page Spec: Add Japanese

## Page Purpose

Add Japanese is the fast capture surface for Japanese the learner encounters in the wild. The page should make it easy to enter a word or phrase and sentence context before the moment is lost.

This is one of Tomo's most important improvements over a deck-first SRS workflow. The learner should not need to choose a deck before saving the Japanese they found. Capture comes first. Organization comes later.

## Primary User Jobs

- Enter a Japanese word or phrase.
- Add the sentence context where it appeared.
- Optionally add image, note, deck, or source.
- Generate a structured study card.
- Continue to Generated Card Review.

## Required Inputs

1. Japanese word or phrase.
2. Sentence context.

Sentence context is highly important because Japanese words can have multiple meanings. The sentence lets Tomo choose the correct sense and produce a more personal card.

## Optional Inputs

- Image.
- User note.
- Deck.
- Source.
- Card type preference.

These should not be required in the first version of the capture form. Source should be especially low priority and collapsed by default.

## UX Notes

The Add page should feel like a capture surface, not a database form. A long field list will slow users down and recreate the friction Tomo is trying to solve.

The user intent is: “I found something Japanese and want to remember it.” The UI should not ask them to perform card architecture before capture.

## UI Notes

- Prioritize the Japanese input and sentence context visually.
- Keep optional details clearly available but secondary.
- Use field labels that describe the learner's task, not the database schema.
- Avoid exposing raw note-type field names in the default form.
- If the user pastes a sentence first, allow the system to infer or ask which word they want to study.
- Provide immediate validation if the sentence does not contain the target expression.

## Interaction Notes

- Create Card moves to Generated Card Review.
- If multiple meanings are detected, the next page should ask the user to choose the intended meaning.
- If sentence context is missing, allow manual continuation only with a warning that meaning confidence is lower.
- If deck is not chosen, suggest a deck later based on context and user defaults.
- If image is added, preserve it through Generated Card Review and Card Detail.

## Validation Behavior

### Good Input

Word and sentence are present, and the sentence contains the target expression. Continue normally.

### Missing Sentence Context

Explain that context helps choose the right meaning. Allow the user to continue manually if they choose.

### Target Not Found in Sentence

Ask the user to confirm or edit. This prevents wrong-sense cards.

### Multiple Candidate Words

If a sentence contains several likely study targets, ask the user to select which one they want to add.

## Responsive Behavior

Desktop can provide optional details in a side or secondary area. Mobile should keep the flow short, with optional details collapsed. The mobile Add flow should be fast enough for out-and-about capture.

## Copy Tone

Use direct, practical language. Avoid saying “AI will generate.” Prefer action-focused wording such as “Create card” or “Build from context.”

## Designer Watchouts

- Do not make deck selection required before capture.
- Do not lead with optional fields.
- Do not expose every card template field upfront.
- Do not call the feature AI in the visible chrome.
- Do not make source context feel important in the first step.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
