# Page Spec: Review Setup

## Page Purpose

Review Setup is an optional tuning surface for learners who want temporary control over today's review session. It should support Anki-like control without forcing every learner through configuration before practice.

The screen should answer: “How do I want to run this session?” It should not answer: “How should my whole SRS system be configured forever?” Permanent scheduling defaults belong in Deck Options or Settings.

## Primary User Jobs

- Include or skip new cards for this session.
- Adjust session size.
- Include or exclude specific decks.
- Choose review order and new-card order.
- Prioritize overdue cards or certain categories when catching up.
- Understand that changes apply only to this session.
- Start the session confidently after tuning.

## Content Hierarchy

### Primary Content

1. Session summary: cards due, estimated time, included decks.
2. New-card choice: include or skip new cards.
3. Session size or timebox.
4. Deck inclusion controls.
5. Start Session action.

### Secondary Content

- Review order controls.
- New-card order controls.
- Catch-up options.
- Related-card burying option, if supported.
- One-time override explanation.

### Content to Avoid

- FSRS parameter tuning.
- Desired retention changes.
- Long-term deck configuration.
- Advanced scheduling presets by default.
- Graphs or performance analytics.

## UX Notes

The setup screen should be easy to skip. The default path from Today should start review directly. Review Setup is for users who want control.

The main UX risk is accidental permanence. Anki-like users are sensitive to whether a change affects only the current session or changes deck behavior. The page must clearly state that session setup choices are temporary overrides unless the user explicitly chooses to save them as defaults.

## UI Notes

- Use clear grouping: Session, New Cards, Decks, Order, Advanced.
- Show advanced controls through progressive disclosure.
- Make the temporary nature of settings visible near the controls and near the final action.
- Keep controls readable and calm. Avoid dense settings-table presentation.
- Use concise labels rather than technical scheduling jargon unless the user opens advanced help.

## Recommended Controls

### High Priority

- Include new cards or skip new cards today.
- Session card limit.
- Deck inclusion.
- Start Session.

### Medium Priority

- Review order.
- New-card order.
- Overdue-first mode.
- Timebox mode.

### Advanced Priority

- Bury related cards for this session.
- Include suspended cards is not recommended by default.
- Relearning-specific controls should be hidden unless needed.

## Interaction Notes

- Changing a control should update estimated time and card count immediately.
- If the learner excludes a deck, show the impact in card count.
- If the learner skips new cards, clarify that due reviews are still included.
- If the learner chooses a timebox, Tomo should explain what happens when the timebox ends.
- Allow “save these choices as my default” only if the design clearly separates it from starting the session.

## States

### Normal Setup

Shows all session controls and defaults from deck settings.

### Catch-Up Setup

When overdue, emphasize manageable sessions, overdue-first choices, and partial completion.

### No Reviews Available

If the user reaches setup with no reviews due, explain the state and offer optional practice or Add Japanese.

### Offline Setup

If deck data is locally available, allow setup. If not, explain what can and cannot be loaded.

## Responsive Behavior

On desktop, controls can be grouped in a two-column composition if the hierarchy remains clear. On mobile, use stacked sections, larger tap targets, and avoid dropdown overload. Mobile setup should be faster and less dense than desktop setup.

## Copy Tone

Use practical copy. Avoid bureaucratic language such as “configuration override applied.” Prefer: “These choices only apply to this session. Your deck defaults stay the same.”

## Designer Watchouts

- Do not make this screen feel required for normal practice.
- Do not bury Start Session below too many controls.
- Do not use permanent settings language for temporary choices.
- Do not expose FSRS controls here.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
