# Page Spec: Cards

## Page Purpose

Cards is the advanced browser for individual study items. It should be Tomo's improved version of Anki's card browser: powerful enough for serious users, but clearer, calmer, and more Japanese-aware.

This page is for search, filtering, mass tagging, bulk operations, repair workflows, and cross-deck card management. It is not the daily review surface and should not compete with Today.

## Primary User Jobs

- Search cards across all decks.
- Filter cards by deck, type, JLPT level, tag, status, and missing fields.
- Select multiple cards.
- Add or remove tags in bulk.
- Move cards between decks.
- Suspend, unsuspend, or mark cards for repair.
- Find problem cards, leeches, or low-retention cards.
- Open Card Detail for deep editing.

## Content Hierarchy

### Primary Content

1. Search.
2. Saved views.
3. Filters.
4. Card results table or list.
5. Bulk action toolbar when cards are selected.

### Secondary Content

- Card preview panel.
- Recent searches.
- Filter count.
- Selected card summary.
- Export or advanced query tools.

### Content to Avoid

- Daily review CTA as the main action.
- Deck-level scheduling settings.
- Long explanations.
- Heavy analytics graphs.

## UX Notes

Cards should support two usage modes:

1. Fast retrieval: find one card and edit it.
2. Batch management: select many cards and apply an action.

The page should make both possible without forcing a novice user into raw query syntax.

## Japanese-Aware Search and Filters

The search system should understand the ways Japanese learners look for cards.

Recommended search capabilities:

- Expression search.
- Reading search.
- English meaning search.
- Sentence search.
- Kana-insensitive matching.
- Kanji search.
- Tag search.
- Deck search.
- JLPT filter.
- Card type filter.
- Status filter.
- Missing field filters.

Recommended Japanese-specific filters:

- JLPT level.
- Part of speech.
- Transitive or intransitive.
- Has audio.
- Has image.
- Has sentence.
- Has nuance note.
- Has mnemonic.
- Has pitch accent.
- Card type.
- Problem status.

## Saved Views

Saved views make advanced search discoverable. They should be visible near the top of the page.

Recommended default views:

- Problem cards.
- Leeches.
- Missing images.
- Missing audio.
- Missing mnemonic.
- Recently added.
- Suspended.
- Production cards.
- Due today.
- N4 verbs.

## Bulk Actions

Bulk actions should appear only after selection.

Recommended actions:

- Add tag.
- Remove tag.
- Move to deck.
- Suspend.
- Unsuspend.
- Mark for repair.
- Change card type.
- Delete, if supported, with confirmation.

Mass tagging is important and should feel first-class. When applying a tag to many cards, show how many cards will be affected and whether review history is changed.

## UI Notes

- Use a strong search bar, then filters, then results.
- Filters should be powerful but not visually overwhelming.
- A card table works well on desktop. On mobile, use card-like result rows.
- Bulk selection should be visually clear.
- The result density should be adjustable if possible.
- Show enough card information to identify items without opening every row.

## Card Result Data

Recommended columns or row fields:

- Expression.
- Reading.
- Meaning.
- Deck.
- Card type.
- Tags.
- Status.
- Due date.
- Retention or problem signal.

Advanced optional data:

- Last reviewed.
- Interval.
- Lapses.
- FSRS stability or difficulty.
- Missing fields.

## Interaction Notes

- Clicking a card opens Card Detail.
- Selecting cards reveals bulk toolbar.
- Filters should update result count immediately.
- Saved views should behave like named filter presets.
- Card preview can appear in a side panel on desktop.
- Power users may need advanced search syntax, but it should not be the only path.

## States

### Default

Show saved views and recent or all cards.

### Search Results

Show result count, active filters, and clear filters control.

### No Results

Help the user revise search. Do not simply say nothing found.

### Bulk Selection

Show count and available actions. Clarify destructive impact.

### Loading Large Results

Use progressive loading and preserve filter state.

## Responsive Behavior

Desktop is the primary environment for heavy card management. Mobile should support search and single-card edits, but bulk operations can be simplified or placed behind an action menu.

## Copy Tone

Use precise card-management language. This is a power surface, so clarity matters more than warmth, but the tone should still avoid harsh system phrasing.

## Designer Watchouts

- Do not hide mass tagging under obscure menus.
- Do not make Cards visually identical to Decks.
- Do not require raw search syntax for common filters.
- Do not expose too much scheduling data by default.
- Do not put review-session controls here.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
