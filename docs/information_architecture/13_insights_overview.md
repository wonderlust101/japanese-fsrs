# Page Spec: Insights Overview

## Page Purpose

Insights Overview is the default landing page for learning reflection. It should feel like a calm teacher report: clear progress, important mistakes, and practical planning. It should not begin as a wall of graphs.

The page should interpret before it visualizes. Charts are welcome when they support a point, but the learner should not need to decode a statistics dashboard to understand what matters.

## Primary User Jobs

- Understand progress made.
- Identify the most important mistake pattern.
- See whether future review load is manageable.
- Decide what to do next.
- Navigate to Mistakes, Progress, Forecast, or Statistics for detail.

## Content Hierarchy

### Primary Content

1. Progress summary.
2. Mistake or weakness summary.
3. Forecast or planning note.
4. Focused next action.

### Secondary Content

- Small chart or trend visualization.
- Problem card entry point.
- Link to Statistics.
- Link to detailed tabs.

### Content to Avoid

- Full graph set.
- Dense FSRS explanations.
- Raw data without interpretation.
- Long AI-labeled summaries.

## UX Notes

The Overview should answer: “Am I improving, what needs attention, and what should I do next?”

It should be useful even for learners who never open Statistics. Advanced users can go deeper, but regular learners should get value immediately.

## UI Notes

- Use report-style sections with clear headings.
- Use only a few charts, and keep them tied to conclusions.
- Show recommendations as practical actions.
- Make Statistics visible as a tab, but not the default content.
- Avoid making every metric visually equal.

## Recommended Sections

### Progress

Shows the most meaningful progress signal: reviewed cards, mature cards, retention trend, or JLPT movement.

### Mistakes

Highlights the most meaningful weakness pattern, not every error.

### Planning

Shows upcoming workload or recommended pacing.

### Detail Navigation

Links or tabs to Mistakes, Progress, Forecast, and Statistics.

## Interaction Notes

- Improve weak spots should route to the relevant repair queue.
- View mistakes should open Insights Mistakes.
- View forecast should open Insights Forecast.
- View statistics should open Statistics tab.
- Charts should be clickable only when they reveal meaningful detail.

## States

### Enough Data

Show progress, mistakes, and forecast.

### New User With Little Data

Explain that insights improve after a few sessions. Show basic guidance and next review action.

### Strong Progress

Celebrate specifically, not loudly.

### Concerning Pattern

Be clear and practical. Avoid alarm.

## Responsive Behavior

Mobile should show one insight at a time with clear actions. Desktop can show a broader report layout.

## Copy Tone

Teacher-like, specific, adult. No “AI analyzed your learning” language.

## Designer Watchouts

- Do not make the Overview a generic analytics dashboard.
- Do not bury the recommendation.
- Do not overload the page with charts.
- Do not invent insights from weak data.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
