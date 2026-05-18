# Page Spec: Today

## Page Purpose

Today is the primary daily entry point for Tomo. Its job is to help the learner understand the immediate review workload, feel calm about starting, and begin or resume practice with minimal hesitation.

Today should not behave like a generic dashboard. It should behave like a practice launchpad. The learner should arrive, understand what is waiting, receive one useful orientation note, and start review. The page can contain future workload information, but only enough to reduce uncertainty and help the learner prepare.

## Primary User Jobs

- Understand whether there are reviews due.
- Start the daily review session immediately.
- Resume an unfinished session.
- Understand whether today's workload is manageable.
- See a short preview of the next few days.
- Receive a small, practical note about what to watch for during review.
- Recover from missed days without shame.
- Understand offline or sync status when relevant.

## Content Hierarchy

### Primary Content

1. Today's review status.
2. Primary action to start or resume review.
3. Estimated effort, such as card count and approximate time.
4. A concise pre-session note focused on a likely weak point or helpful reminder.
5. Compact upcoming workload preview.

### Secondary Content

- Link to tune the session.
- Review load explanation.
- Short deck distribution preview if it helps planning.
- Offline or sync reassurance.

### Content to Avoid on Today

- Full weak spot lists.
- Dense analytics.
- Multiple graphs.
- Full deck library.
- Account or profile information.
- Long AI explanations.
- Generic motivational chatter.

## UX Notes

Today should support momentum. The learner should never need to parse a dashboard before practicing. If there are reviews due, the action should be obvious. If there are no reviews due, the page should make completion feel valid rather than suggesting the learner has failed to do enough.

The most important UX distinction is between readiness and analysis. Today is readiness. Insights is analysis. If a content block asks the learner to interpret long-term behavior, it likely belongs in Insights. If it helps the learner decide whether and how to start now, it may belong on Today.

## UI Notes

- Use a strong visual hierarchy for due count, estimated time, and start action.
- Keep the main action visually dominant but not aggressive.
- Use warm, quiet status copy rather than system-heavy wording.
- Treat the pre-session note as a small teacher note, not a marketing banner.
- Keep future workload compact. A small sequence of days or a lightweight summary is enough.
- Avoid turning the page into a card wall. Too many equal-weight cards will make the page feel like an admin dashboard.

## Page States

### Reviews Due

The default state. Prioritize start review, estimated time, and one pre-session note. The learner should feel prepared and not overloaded.

Suggested copy direction: “42 reviews waiting. About 12 minutes.”

### No Reviews Due

The learner should feel complete. Offer optional actions such as Add Japanese or Practice weak spots, but they should not feel like obligations.

Suggested copy direction: “You’re clear for today.”

### Overdue

The page should reduce avoidance. Do not moralize missed days. Give a small first step.

Suggested copy direction: “A few reviews have piled up. Let’s make the first session small and useful.”

### Severe Backlog

Break the workload into a manageable first session. Avoid implying that everything must be cleared immediately.

Suggested copy direction: “There’s a larger backlog today. Start small. Clearing part of it still counts.”

### Session in Progress

Resume should override the normal page hierarchy. The learner started something, so continuity matters most.

### First-Time User

The page should introduce Tomo's value before requiring setup. A short explanation and sample review should appear before account creation or onboarding questions.

### Offline

If review can continue offline, say so clearly. The emotional question is whether progress is safe.

### Error

Errors should explain what failed, whether data is safe, and what the user can do next.

## Interaction Notes

- Start Review launches the default session directly.
- Tune Session opens optional session setup.
- Resume Session returns to the unfinished review state.
- Upcoming workload can link to Insights Forecast if the learner wants detail.
- Pre-session note may link to related cards or examples, but should not interrupt the review start path.

## Responsive Behavior

Desktop can show a richer workload preview. Mobile should prioritize Start or Resume, then the note, then a minimal future preview. The mobile experience should respect quick sessions during commute or short breaks.

## Copy Tone

Use calm, adult, specific language. Avoid cheerleading, guilt, or productivity-software phrasing. The voice should feel like a competent teacher quietly helping the learner begin.

## Designer Watchouts

- Do not make Today too empty by removing useful readiness information.
- Do not make Today too crowded by importing analytics and deck management.
- Do not expose too many secondary actions above the primary review action.
- Do not make no-review states feel like missed opportunity states.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
