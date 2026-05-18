# Page Spec: Review Summary

## Page Purpose

Review Summary closes the practice loop. It should tell the learner what happened, what went well, what needs attention, and what the most useful next action is.

This page is a teaching moment, but it should not turn completion into homework. The learner should be allowed to leave feeling done. If there are weak spots, the page should offer a focused improvement path.

## Primary User Jobs

- Understand whether the session went well.
- See completion, time, and card count.
- Understand the most important mistake pattern.
- Identify weak spots worth repairing or reviewing.
- Choose one next action.
- Leave without guilt.

## Content Hierarchy

### Primary Content

1. Completion message.
2. Session summary: reviewed cards, time, completion status.
3. Performance signal: rating breakdown or success pattern.
4. Mistake diagnosis.
5. Primary next action.

### Secondary Content

- Problem card list.
- Links to Insights.
- Option to review weak spots.
- Option to improve weak spots.
- Tomorrow or next-session preview.

### Content to Avoid

- Full analytics dashboard.
- Too many charts.
- Generic AI summary language.
- Shame copy.
- Long paragraphs before showing completion.

## UX Notes

The Summary should answer three questions:

1. Did I finish?
2. What needs attention?
3. What should I do now?

Do not make Open Insights the default primary action. Insights is broad. The Summary should offer a focused action based on the session result, such as Improve weak spots, Review weak spots, or Leave for today.

## Primary Action Logic

| Session Pattern | Recommended Primary Action |
|---|---|
| Strong session with few mistakes | Leave for today |
| Normal session with small issues | Leave for today, with optional Insights |
| Repeated mistakes | Improve weak spots |
| Many difficult cards | Review weak spots |
| Weak-spot-like behavior | Repair weak spots |
| Overdue catch-up | Stop at a good point or continue small catch-up |

## UI Notes

- The completion state should be visually clear and emotionally calm.
- Use one primary action. Secondary actions should not compete.
- Use a small number of meaningful metrics rather than a dense report.
- Mistake diagnosis should be specific and concise.
- Weak spots should be scannable and actionable.
- If charts appear, they should support a point rather than decorate the page.

## Mistake Diagnosis Guidance

A good summary does not say: “You made 8 mistakes.”

A better summary says: “Transitive pairs were the clearest rough spot today. 開く and 開ける appeared in repeated misses.”

The diagnosis should identify a pattern when one exists. If no meaningful pattern exists, say that clearly and keep the page short.

## Interaction Notes

- Improve weak spots opens the repair queue.
- Review weak spots starts a focused drill or filtered mini-session.
- Open Insights goes to the relevant tab, not a generic landing, when possible.
- Leave for today returns to Today or a calm completed state.
- Individual weak spots should be clickable to Card Detail.

## States

### Good Session

Keep it short. Do not over-analyze success.

### Mixed Session

Show what went well and what needs attention.

### Difficult Session

Be specific and supportive. Avoid alarm.

### Overdue Catch-Up

Reinforce partial progress. Suggest stopping at a reasonable point.

### No Meaningful Pattern

Do not invent a pattern. Show basic session stats and offer optional review.

## Responsive Behavior

Mobile summary should be shorter and action-focused. Desktop can show more detail, but still avoid turning the summary into Insights.

## Copy Tone

Quietly encouraging, specific, adult. No XP language, no streak pressure, no “failure” framing.

## Designer Watchouts

- Do not bury the completion message.
- Do not put too many equal-weight CTAs on the page.
- Do not force the learner into more study after finishing.
- Do not make every session sound diagnostic if the data does not justify it.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
