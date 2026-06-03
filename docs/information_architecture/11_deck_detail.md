# Page Spec: Deck Detail

## Page Purpose

Deck Detail helps the learner understand and manage one deck. It should show what the deck contains, how it contributes to review load, how it is performing, and what deck-specific actions are available.

This page is about the collection. It should not become the full Cards browser, but it should provide clear access to cards in this deck.

## Primary User Jobs

- Understand deck scope.
- Study this deck.
- See due cards and future load for this deck.
- Open Cards filtered to this deck.
- Adjust deck options.
- Add a card specifically to this deck.
- Pause or adjust new cards.
- Inspect deck-level progress.

## Content Hierarchy

### Primary Content

1. Deck title and description.
2. Due count and review load.
3. Study this deck action.
5. Access to cards in this deck.
6. Deck options.

### Secondary Content

- Total cards.
- New cards.
- Mature cards.
- Retention.
- Recent activity.
- Daily new-card setting.
- Last studied.

### Advanced Content

- Deck-specific scheduling settings.
- FSRS preset.
- Review order defaults.
- Import/export controls.
- Advanced deck maintenance.

## UX Notes

The page should make the deck's current condition visible without making the learner read a report. The key questions are: is there work due, and what action should I take?

Deck Detail should connect cleanly to Cards. If users want to edit individual cards, the action should route to Cards with this deck filter applied.

## UI Notes

- Place due workload and study action high in the hierarchy.
- Separate deck-level settings from card-level management.
- Avoid showing a huge card list by default if it makes the page feel heavy.
- Provide search within deck or a clear link to card browser filtered to deck.

## Recommended Deck Data

- Name.
- Description.
- Scope or level.
- Due today.
- New cards available.
- Total cards.
- Mature card count.
- Retention signal.
- Daily new-card limit.
- Review load trend.
- Last studied.

## Recommended Actions

- Study this deck.
- Open Cards in this deck.
- Add card to this deck.
- Deck options.
- Pause new cards.
- Rename deck.
- Archive deck.
- Export deck, if supported.

## Deck Options Access

Deck Options should be visible because Anki-like users expect deck-level control. However, the default detail page should not display every option at once. Use a clear entry point into a dedicated options area.

## Interaction Notes

- Study this deck starts a deck-filtered session or opens Review Setup with the deck preselected.
- Open Cards in this deck preserves deck context in the Cards page.
- Add card to this deck opens Add Japanese with deck preselected, but global Add should remain the primary capture path.
- Pause new cards should explain what changes and what does not.

## States

### Active Deck With Due Reviews

Prioritize study action and due workload.

### Active Deck With No Due Reviews

Show next due date and optional study actions.

### New Deck With No Cards

Offer Add Japanese, import, or browse premade content.

### Overloaded Deck

Show review load and suggest reducing new cards or using catch-up planning.

### Paused Deck

Show paused status and resume control.

## Responsive Behavior

Desktop can include deck summary, and cards access in one page. Mobile should prioritize due count, study action, and high-level deck info before management actions.

## Copy Tone

Use direct collection language. 

## Designer Watchouts

- Do not turn Deck Detail into the full Cards page.
- Do not hide deck options from power users.
- Do not require deck-specific Add for normal capture.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
