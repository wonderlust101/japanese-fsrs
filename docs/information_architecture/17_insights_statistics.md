# Page Spec: Insights Statistics

## Page Purpose

Insights Statistics is the advanced data room for Anki-like users. It should include detailed SRS and FSRS information, but group it more clearly than a raw statistics dump.

Statistics lives as a tab inside Insights so power users can access it without making every learner start inside a graph-heavy interface.

## Primary User Jobs

- Inspect detailed review history.
- Understand retention behavior.
- View card counts and maturity states.
- Analyze scheduling and future due load.
- Inspect FSRS behavior.
- Compare decks, card types, and time ranges.

## Content Hierarchy

Statistics should be grouped by user question rather than by implementation detail.

Recommended sections:

1. Activity.
2. Retention.
3. Cards.
4. Scheduling.
5. FSRS.

## Section Guidance

### Activity

Question: How much have I studied?

Recommended metrics:

- Review count.
- Review time.
- Calendar activity.
- Added cards.
- Reviews by day.

### Retention

Question: How well am I remembering?

Recommended metrics:

- True retention.
- Answer button distribution.
- Retention by deck.
- Retention by card type.
- Mature-card retention.

### Cards

Question: What is my collection made of?

Recommended metrics:

- New cards.
- Learning cards.
- Young cards.
- Mature cards.
- Suspended cards.
- Cards by deck.
- Cards by type.
- Cards by JLPT level.

### Scheduling

Question: What is coming next?

Recommended metrics:

- Future due.
- Daily load.
- Review intervals.
- Upcoming workload by deck.
- Overdue impact.

### FSRS

Question: How is scheduling behaving?

Recommended metrics:

- Desired retention.
- True retention versus desired retention.
- Stability distribution.
- Difficulty distribution.
- Retrievability if exposed.
- Optimization status.

## UX Notes

This is a power surface, but it should still be designed. The goal is not to remove complexity. The goal is to organize complexity by intent.

Statistics should not be the default Insights experience for regular users. However, it should be easy to find for Anki users.

## UI Notes

- Use section navigation within Statistics.
- Let users change time range globally.
- Make chart labels clear and accessible.
- Provide short explanations for technical metrics.
- Avoid chart overload on one unstructured page.
- Allow export or advanced inspection if needed, but keep it secondary.

## Interaction Notes

- Time range controls should apply consistently.
- Deck filters should work across relevant sections.
- Charts should support hover or focus details on desktop.
- On mobile, detailed charts may need simplified views.
- FSRS metrics should include plain-language descriptions.

## States

### Enough Data

Show full statistics.

### Limited Data

Show available metrics and explain what will appear later.

### FSRS Not Enabled or Not Enough FSRS Data

Explain clearly and avoid empty panels.

### Heavy Data

Use progressive loading and section-level loading states.

## Responsive Behavior

Desktop is the primary environment for Statistics. Mobile should be usable, but it can prioritize summaries and simplified charts.

## Copy Tone

Precise and technical where needed, but not obscure. A power user should trust the data, and a regular user should not feel mocked for needing explanations.

## Designer Watchouts

- Do not blend Statistics into Overview.
- Do not make charts decorative.
- Do not hide time range controls.
- Do not show FSRS values without explanation.
- Do not make technical data color-dependent.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
