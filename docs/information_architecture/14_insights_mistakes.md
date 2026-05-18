# Page Spec: Insights Mistakes

## Page Purpose

Insights Mistakes helps learners understand what they are getting wrong and why. It should identify patterns, weak spots, card-quality issues, and weak card types.

This page should turn mistakes into useful study decisions, not shame or noise.

## Primary User Jobs

- See repeated mistake patterns.
- Find weak-spot cards.
- Understand whether errors come from memory, ambiguity, or card quality.
- Start repair or focused review.
- Open weak spots in Cards or Card Detail.

## Content Hierarchy

### Primary Content

1. Top mistake pattern.
2. Weak spots.
3. Repair or focused review actions.

### Secondary Content

- Mistakes by deck.
- Mistakes by card type.
- Recent misses.
- Cards with missing support fields.

### Advanced Content

- Lapse trends.
- Retention by problem category.
- Difficulty distributions.
- Detailed history.

## UX Notes

A mistake page should not simply list failures. It should explain likely causes and offer next steps.

Examples of useful categories:

- Confused with similar word.
- Meaning too vague.
- Missing sentence context.
- Production prompt ambiguous.
- Weak mnemonic.
- No audio or image support.
- Card may need suspension.

## UI Notes

- Group mistakes by pattern, not only by individual card.
- Use problem severity carefully. Avoid red-heavy punishment visuals.
- Provide direct actions: repair, review, open card, suspend.
- Show enough context to understand the issue without opening every card.
- Make filters available for deck, card type, and time range.

## Recommended Sections

### Pattern Summary

Plain-language diagnosis of the biggest current issue.

### Weak spots

Cards that repeatedly failed or show concerning behavior.

### Weak spots

Cards with repeated lapses that may need repair, simplification, or suspension.

### Confusable Items

Words or grammar patterns being mixed up.

### Card Quality Issues

Cards missing fields or support that may explain poor retention.

## Interaction Notes

- Repair selected cards opens Weak spot repair.
- Review selected cards starts a focused mini-session.
- Open in Cards applies the relevant filter.
- Open Card Detail goes to a single card.
- Suspend should be available but not pushed as the default.

## States

### No Major Mistakes

Say so clearly and avoid inventing work. Offer optional deeper view.

### Many Mistakes

Prioritize the top pattern and avoid overwhelming the user.

### Weak spot Heavy

Recommend repair or suspension. Explain that suspension can be a healthy choice.

### Not Enough Data

Explain that mistake patterns need more reviews.

## Responsive Behavior

Desktop can show grouped lists and filters. Mobile should focus on one group at a time, with direct actions.

## Copy Tone

Use careful language. Prefer “needs attention” over “bad.” Prefer “this card may need repair” over “you keep failing this.”

## Designer Watchouts

- Do not make mistakes feel like a punishment report.
- Do not list every wrong answer with equal importance.
- Do not hide repair actions.
- Do not overuse alarming color.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
