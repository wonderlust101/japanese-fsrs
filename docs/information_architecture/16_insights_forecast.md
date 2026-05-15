# Page Spec: Insights Forecast

## Page Purpose

Insights Forecast helps learners plan future workload. It should explain upcoming reviews, new-card impact, backlog recovery, and how choices today affect the next few days.

Forecast is planning, not analytics for its own sake.

## Primary User Jobs

- Understand future due load.
- See whether upcoming days are manageable.
- Understand the impact of new cards.
- Plan catch-up after missed days.
- Adjust future pacing.
- Identify decks driving review load.

## Content Hierarchy

### Primary Content

1. Upcoming due load.
2. Manageability signal.
3. New-card impact.
4. Suggested pacing or adjustment.
5. Deck contributors.

### Secondary Content

- Day-by-day load.
- Time estimate.
- Catch-up scenarios.
- Weekend or busy-day planning.

### Advanced Content

- Scenario modeling.
- Desired retention impact.
- Deck-level forecast.
- FSRS-specific scheduling explanations.

## UX Notes

The Forecast page should help the learner avoid overload. It should not make them feel trapped by future numbers.

The most useful forecast is actionable: “Sunday is heavier than usual. Consider skipping new cards tomorrow.”

## UI Notes

- Use a clear day-by-day workload presentation.
- Pair forecast charts with plain-language recommendations.
- Let users explore what happens if they change new-card pace.
- Show deck contributors so users know where load comes from.
- Avoid making every future day feel urgent.

## Recommended Sections

### Upcoming Workload

Shows next several days or weeks depending on user setting.

### Planning Note

Plain recommendation based on upcoming load.

### New Card Impact

Shows how adding or skipping new cards affects workload.

### Catch-Up Planner

For overdue users, suggests manageable recovery paths.

### Deck Contributors

Shows which decks contribute most to future load.

## Interaction Notes

- Adjusting new-card assumption should update forecast.
- Catch-up planner should offer small session options.
- Deck contributor rows should link to Deck Detail or Cards filtered by deck.
- Forecast from Today should deep-link here if the user wants detail.

## States

### Manageable Week

Keep it calm and brief.

### Heavy Upcoming Load

Suggest pacing changes.

### Backlog Recovery

Offer partial, realistic plans.

### No Forecast Data

Explain what data is needed.

## Responsive Behavior

Desktop can show richer charts and scenarios. Mobile should focus on the next few days and one recommendation.

## Copy Tone

Practical and reassuring. Avoid crisis language.

## Designer Watchouts

- Do not make forecast feel like a punishment calendar.
- Do not hide the recommended action.
- Do not use dense charts without interpretation.
- Do not make scenario controls too technical by default.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
