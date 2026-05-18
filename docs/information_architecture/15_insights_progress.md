# Page Spec: Insights Progress

## Page Purpose

Insights Progress shows long-term movement. It should help learners understand whether their practice is accumulating into durable retention, mature cards, JLPT progress, and stable study behavior.

This page is about trajectory, not daily performance.

## Primary User Jobs

- Understand long-term progress.
- See retention trend.
- See mature card growth.
- Understand progress toward JLPT target.
- Review consistency without streak pressure.
- Compare progress across decks or card types.

## Content Hierarchy

### Primary Content

1. Progress summary.
2. Retention trend.
3. Mature card growth.
4. JLPT or level progress, if reliable.
5. Study consistency.

### Secondary Content

- Progress by deck.
- Progress by card type.
- Added cards over time.
- Time spent.
- Recent milestone.

### Advanced Content

- True retention by date range.
- Mature retention by deck.
- Stability growth.
- Detailed card-state transitions.

## UX Notes

Progress should feel earned but not gamified. Avoid streak pressure and XP framing. The learner is an adult practicing seriously.

Progress signals should be meaningful. “You reviewed 500 cards” is less valuable than “72 cards moved into long-term memory” if the latter can be calculated honestly.

## UI Notes

- Use a small number of meaningful trend charts.
- Pair metrics with plain-language interpretation.
- Avoid vanity metrics as the main focus.
- Make time ranges easy to change.
- Keep comparisons readable and not overly competitive.

## Recommended Sections

### Progress Summary

A plain-language view of the learner's current trajectory.

### Retention

Shows whether memory performance is stable, improving, or slipping.

### Mature Cards

Shows durable accumulation over time.

### JLPT Progress

Shows coverage only if the underlying mapping is credible. Avoid false precision.

### Consistency

Shows regular practice without guilt mechanics.

## Interaction Notes

- Time range controls should update all related metrics.
- Deck comparison should open deeper detail only when useful.
- JLPT progress should link to relevant decks or cards.
- Progress gaps should suggest recovery, not shame.

## States

### Strong Progress

Celebrate specifically and quietly.

### Plateau

Explain possible causes and offer practical next steps.

### Declining Retention

Recommend reviewing weak spots or adjusting new-card load.

### Limited Data

Set expectations about what can be shown.

## Responsive Behavior

Desktop can show multiple progress sections. Mobile should present key insights first, with charts that are easy to read vertically.

## Copy Tone

Encouraging, specific, not cheerleading. Avoid “crushing it” style copy.

## Designer Watchouts

- Do not create fake precision in JLPT progress.
- Do not use streak pressure.
- Do not make progress depend only on volume.
- Do not bury interpretation under charts.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
