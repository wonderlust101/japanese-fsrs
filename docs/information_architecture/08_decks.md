# Page Spec: Decks

## Page Purpose

Decks is the management hub for study collections. It should help learners understand what decks they have, what each deck contributes to their workload, and how deck-level settings affect practice.

Decks are containers and scheduling contexts. Cards are individual learning objects. This page should focus on collections, not individual card editing.

## Primary User Jobs

- View all decks in the learner's library (user-built and copied-from-premade alike — once added, all decks are equivalent and editable).
- Understand which decks have reviews due.
- Study a specific deck.
- Open deck details.
- Adjust deck options.
- Browse premade decks.
- Add a premade deck to the library (copies it once; no ongoing subscription).
- Understand deck health at a glance.

## Content Hierarchy

### Primary Content

1. My decks.
2. Due status and review load per deck.
3. Deck-level actions: study, open, options.
4. Explore or import deck entry point.

### Secondary Content

- Retention per deck.
- Daily new-card setting.
- Total cards.
- New, learning, mature breakdown.
- Recent activity.

### Content to Avoid

- Full card table.
- Bulk card tagging.
- Advanced card search.
- Long analytics sections.
- Full FSRS statistics.

## UX Notes

Decks should serve both everyday learners and Anki-like users. A regular learner should understand their collections quickly. A power user should be able to access deck options and deck-specific data without hunting.

The page should not become a substitute for Cards. If the user wants to search or mass edit individual cards, provide a clear action that opens Cards filtered to that deck.

## UI Notes

- Deck cards or rows should show the deck name, due count, total card count, and a short health signal.
- Use visual hierarchy to separate due workload from descriptive metadata.
- Actions should be clear but not crowded.
- The strongest action on a deck is usually Study or Open, depending on due state.
- Deck Options should be visible enough for Anki-like users but not visually dominant.
- Explore Premade Decks should be available, but secondary to My Decks.

## Recommended Deck-Level Data

- Deck name.
- Deck type or scope.
- Due today.
- New cards available.
- Total cards.
- Retention or health signal.
- Daily new-card limit.
- Review load trend.
- Last studied.

## Recommended Actions

- Study this deck.
- Open deck.
- Open cards in this deck.
- Deck options.
- Add card to this deck.
- Pause new cards.
- Rename or archive deck.

## Interaction Notes

- “Open cards in this deck” should route to Cards with the deck filter applied.
- Study this deck starts a deck-filtered review session or setup.
- Deck options should clarify when changes affect future scheduling.
- Browse premade decks should lead to Deck Preview before the user commits to adding the deck to their library.
- Adding a deck should explain expected review load before the copy lands in the library.
- Decks copied from premade may show a small "From: <premade deck name>" attribution chip (informational only — once copied the deck is fully the user's own).

## States

### Has Decks

Default state. Prioritize active decks and due workload.

### No Decks

Offer premade deck selection and Add Japanese. Do not leave the page blank.

### Decks With No Due Cards

Show completion and next due preview.

### Overloaded Deck

Show clear load signal and suggest adjusting new cards or catch-up planning.

### Paused Deck

Show paused status and easy resume control.

## Responsive Behavior

Desktop can show deck cards or a structured deck table. Mobile should prioritize concise deck cards with clear actions. Avoid desktop-style dense metadata on mobile.

## Copy Tone

Use clear collection language. Avoid SaaS labels like “resources” or “assets.” These are decks, because the audience understands decks.

## Designer Watchouts

- Do not hide deck options too deeply.
- Do not make Decks a generic library of everything.
- Do not include bulk card operations here.
- Do not require users to inspect each deck to understand workload.
- Do not make premade decks feel like ads.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
