# Tomo Sitemap and Page Descriptions

## Purpose

This sitemap defines the recommended page structure for Tomo as a Japanese-tailored FSRS app. The structure separates daily practice, card creation, deck management, card management, insight, and settings so each area has a clear user job.

Tomo should feel like a calm practice instrument with Anki-level power available when needed. The navigation should not flatten every feature into one generic dashboard. It should help learners quickly understand where to practice, where to add Japanese, where to manage decks, where to manage individual cards, and where to understand progress.

## Primary Navigation

| Nav Item | Primary User Question | Description |
|---|---|---|
| Today | What should I practice right now? | Daily practice launchpad. Shows due reviews, a calm pre-session note, session resume states, and short future workload preview. |
| Add | How do I capture Japanese I found? | Fast capture flow for a Japanese word or phrase plus sentence context. The goal is to turn real-world Japanese into high-quality study material with minimal friction. |
| Decks | What collections am I studying? | Deck-level management for user decks, subscribed decks, premade decks, deck options, scheduling defaults, and deck-specific actions. |
| Cards | How do I search, edit, tag, or repair individual cards? | Advanced card browser for search, filters, bulk actions, mass tagging, card quality management, and cross-deck card operations. |
| Insights | How am I progressing, and what needs work? | Teacher-report style learning insight area with progress, mistakes, forecasting, and an advanced statistics tab for Anki-style data. |
| Settings | How should Tomo behave? | Account, learning preferences, review behavior, display, data, sync, and security. |

## Page List

| File | Page | Short Description |
|---|---|---|
| `01_today.md` | Today | Main daily hub for review readiness, start/resume review, upcoming workload, no-review states, overdue recovery, and first-time value preview. |
| `02_review_setup.md` | Review Setup | Optional session tuning screen for temporary review overrides such as skipping new cards, changing session size, deck inclusion, and card order. |
| `03_review_session.md` | Review Session | Focused review mode with large centered cards, minimal chrome, no hints, keyboard support, mobile review support, and card-type-specific layouts. |
| `04_review_summary.md` | Review Summary | Post-session reflection that explains performance, identifies mistakes, offers focused next actions, and closes the practice loop without forcing more work. |
| `05_problem_card_repair.md` | Problem Card Repair | Guided repair flow for cards that repeatedly fail. Diagnoses likely issues, suggests improvements, and offers optional drilling after repair. |
| `06_add_japanese.md` | Add Japanese | Capture-first page for entering a Japanese word or phrase and sentence context before generated card review. |
| `07_generated_card_review.md` | Generated Card Review | Confirmation page where the learner chooses meaning, reviews generated fields, selects card types, assigns deck, and saves created cards. |
| `08_decks.md` | Decks | Deck management hub for study collections, premade decks, deck health, scheduling defaults, and deck-level actions. |
| `09_cards.md` | Cards | Card browser for search, filtering, saved views, mass tagging, bulk actions, and cross-deck management. |
| `10_card_detail.md` | Card Detail | Deep view for one card or note: fields, generated card types, history, scheduling, tags, quality status, and repair actions. |
| `11_deck_detail.md` | Deck Detail | Detail page for one deck with deck health, review load, deck-specific cards, deck options, and deck-level study actions. |
| `12_deck_preview.md` | Deck Preview | Premade deck inspection page with sample cards, included fields, estimated review load, scope, and subscribe controls. |
| `13_insights_overview.md` | Insights Overview | Default insights landing page: calm teacher report focused on progress, mistakes, and future workload. |
| `14_insights_mistakes.md` | Insights Mistakes | Mistake analysis area for leeches, repeated misses, confusable words, weak patterns, and problem card workflows. |
| `15_insights_progress.md` | Insights Progress | Long-term progress area for retention, mature cards, JLPT movement, consistency, and learning trajectory. |
| `16_insights_forecast.md` | Insights Forecast | Planning area for future due load, new card impact, backlog recovery, and review load smoothing. |
| `17_insights_statistics.md` | Insights Statistics | Advanced Anki-style statistics grouped by activity, retention, cards, scheduling, and FSRS behavior. |
| `18_settings.md` | Settings | Product behavior and account controls, including learning preferences, review defaults, display, sync, and security. |
| `19_first_time_experience.md` | First-Time Experience | Value-first onboarding path: short explanation, sample review, account creation, JLPT target, and premade deck selection. |
| `20_offline_error_states.md` | Offline and Error States | Cross-product state guidance for offline review, sync reassurance, local saves, recoverable errors, and safe failure copy. |

## Information Architecture Rationale

### Why Decks and Cards are separated

Decks and Cards support different mental models. Decks are containers and scheduling contexts. Cards are individual learning objects. A serious SRS user expects both levels of control.

Decks should answer: what am I studying, what is due, what are the deck defaults, and how does this collection behave?

Cards should answer: where is this specific item, how do I edit it, what tags does it have, what fields are missing, and how do I manage many cards at once?

Combining them under a single Library label hides this distinction and weakens information scent for Anki-like workflows.

### Why Review is not necessarily a desktop nav item

Review is the core action, but on desktop it can be launched from Today. This keeps navigation focused on destinations rather than transient modes. On mobile, Review may appear as a bottom-nav action because mobile use is often task-immediate: open app, review, close app.

### Why Insights has both Overview and Statistics

Tomo needs to support regular learners and Anki power users. The Overview should interpret learning in plain language. Statistics should expose detailed data for users who want deeper inspection. These should be adjacent but not blended into one dense dashboard.

## Recommended Desktop Navigation

1. Today
2. Add
3. Decks
4. Cards
5. Insights
6. Settings

## Recommended Mobile Navigation

Recommended default:

1. Today
2. Add
3. Review
4. Decks
5. Insights

Cards can be accessed from Decks, search, or a More pattern on mobile. Bulk card management is primarily a desktop workflow and should not dominate the mobile bottom nav unless testing shows users expect it there.

## Global UX Principles

- Practice comes first. Daily review should be faster to start than to configure.
- Japanese content is the hero. Chrome should support recall, not compete with it.
- Add is capture-first. Do not force deck selection before the learner saves the Japanese they found.
- Decks are containers. Cards are learning objects. Keep the distinction clear.
- Insights should interpret before it visualizes. Graphs are useful, but conclusions should be easier to understand than raw data.
- AI should appear as useful output, not as chrome. Do not label every smart behavior as AI.
- Power should be available through progressive disclosure. Do not make regular users live inside advanced configuration.
- No shame states. Missed days and backlog should be handled as recovery design, not failure messaging.

## Documentation Notes for Designers

These page files intentionally avoid fixed wireframes. They define page purpose, hierarchy, interaction behavior, states, and design constraints. Designers should use them to create original mid-fidelity layouts while preserving the product logic.
