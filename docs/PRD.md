# Product Requirements Companion

This document is a companion to the canonical product strategy in [PRODUCT.md](PRODUCT.md). When this file conflicts with [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), or [DATABASE.md](DATABASE.md), those canonical docs win.

Current project tasks live in [KANBAN_BOARD.md](KANBAN_BOARD.md). Status summary lives in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), with detailed evidence split under [status/](status/).

---

## Product Goal

Tomo is a calm, Japanese-aware spaced-repetition practice app for serious adult learners. It combines FSRS scheduling, curated Japanese decks, manual card creation, analytics, and AI assistance (card generation, contextual sentences, mnemonics, leech diagnosis) in one product so learners do not need to stitch together Anki, chatbots, and separate Japanese-learning tools. For the MVP release, every feature is free.

The core job-to-be-done is: help learners retain Japanese vocabulary, kanji, and grammar with low friction and useful insight, without making daily review feel like grinding.

## Requirement Areas

| Area | Requirement |
|---|---|
| Daily practice | Load due reviews quickly, preserve keyboard-first review flow, support offline review buffering, and make the review ritual feel calm rather than punitive. |
| FSRS scheduling | Use FSRS v5 for review scheduling, with separate cognitive modalities for comprehension, production, and listening. Persist full scheduling state and review history safely. |
| Cards and decks | Support user decks, curated premade decks, personal copies of premade content, manual card creation, AI-assisted card creation, semantic similarity, and version-safe edits. |
| Japanese content | Represent JLPT levels including `beyond_jlpt`; support vocabulary, grammar, and sentence field shapes; preserve Japanese typography, furigana, and CJK rendering. |
| Personalization | Store native language, JLPT target, study goal, daily limits, retention target, timezone, and user interests. Use these preferences to shape review limits and AI output. |
| AI learning assistance | All MVP learners get card generation, contextual example sentences, mnemonics, and leech diagnosis with prescriptive learning guidance. AI is gated by authentication and per-user cost-control rate limits only; no entitlement gates. AI should be visible through output quality, not through chrome or sparkle branding. |
| Analytics | Provide retention heatmap, accuracy by cognitive modality, JLPT gap/progress, milestone forecasts, and review forecasts. Streaks are deferred to a later product version. |
| Accessibility | Meet WCAG 2.1 AA as a floor; keep keyboard review canonical; support screen readers, `lang="ja"`, semantic furigana, reduced motion, and color-blind-safe review affordances. |
| Business model | All features ship free for the MVP release. Code paths must not check entitlement / tier flags; AI surfaces are gated only by auth + cost-control rate limits. A monetization model may be revisited in a later phase once the product has shipped and reached learners. |

## Scope Guidance

The current active scope is a complete daily-practice SRS: auth, onboarding, profile preferences, deck/card management, review scheduling, premade deck adoption, offline review recovery, core analytics, and accessible product chrome. Streak surfaces are intentionally out of current scope and deferred to a later version.

Active work is tracked in [KANBAN_BOARD.md](KANBAN_BOARD.md). When requirements change, update the board, [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), and the relevant [status/](status/) file together so planning and inspected status stay aligned.

## Acceptance Criteria

- A new learner can sign up, set goals, choose starter decks, review cards, and see progress without needing another SRS.
- A returning learner can complete daily reviews by keyboard, including offline submission and reconnect sync.
- User-owned review data is never written to premade source cards.
- Card and deck edits use optimistic concurrency where required.
- AI endpoints sanitize inputs, validate structured outputs, respect rate limits, and avoid exposing OpenAI or Supabase service credentials to the client.
- Product copy and UI remain consistent with [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md), especially the invisible-AI and no-guilt practice principles.

---

*Last updated: 2026-05-14 (Stage 7: all features free for MVP).*
