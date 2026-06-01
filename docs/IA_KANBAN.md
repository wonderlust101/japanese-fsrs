---

kanban-plugin: board

---

Scoped tracking for information-architecture work only — per-page design adoption, IA doc consistency, naming reconciliations, and per-surface implementation status. Cross-cutting product work lives in [KANBAN_BOARD.md](KANBAN_BOARD.md). IA source documents live in [information_architecture/](information_architecture/README.md). Refreshed 2026-05-14.

## To Do

- [ ] **IA wireframe doc cleanup (low-risk)**
	  - `docs/information_architecture/00_sitemap.md:65` contains a stray absolute path (`/home/sergei/Downloads/tomo_wireframes_by_page/01_today.md`) injected mid-tree — delete.
	  - `00_sitemap.md:30` says *"the generated Lapis-compatible note"*. "Lapis" is a foreign product name; replace with "Tomo card note".
	  - `03_review_session.md:201` references *"the legacy design system's four-channel rating rule"* — current design system lives in [DESIGN.md](DESIGN.md); drop the "legacy" framing.
- [ ] **Reconcile IA card types with `card_type` schema**
	  - Canonical enum is `comprehension | production | listening` ([`packages/shared-types/src/fsrs.types.ts`](../packages/shared-types/src/fsrs.types.ts), [DATABASE.md](DATABASE.md), [TDD.md](TDD.md)). IA describes *Vocabulary Recognition* + *Sentence Understanding* + *Production* and omits Listening entirely (`03_review_session.md`, `07_generated_card_review.md`, `10_card_detail.md`, `00_sitemap.md`).
	  - Decide: ship Listening for MVP (add wireframes for audio-front cards) **or** defer Listening explicitly in IA + canonical docs. Clarify that "Vocabulary Recognition" and "Sentence Understanding" are `layout_type` variants of `comprehension`, not peer `card_type` values.
- [ ] **Resolve "Problem Card" vs "Weak spot" vocabulary**
	  - Backend, status docs, and PRODUCT.md all say "weak spot" (`/api/v1/weak-spots`, weak spot-drill, AI weak-spot diagnosis). New IA renames the surface to **Weak spot repair** with `/review/repair` and `/review/repair/[cardId]` (`05_weak_spot_repair.md`, `14_insights_mistakes.md`).
	  - Either bless "Problem Card" as the canonical user-facing label (requires explicit PRODUCT.md edit) or rewrite the IA pair to use "Weak spot". Pick one before the weak spots frontend lands.
- [ ] **Settings IA: missing sections**
	  - IA `18_settings.md` proposes top-level Account / Learning / Review behavior / Display / Data and sync / Security. Current app ships `/settings`, `/settings/learning`, `/settings/profile`, `/settings/security` only.
	  - Add wireframes (or explicit deferral notes in IA) for Display, Data & sync, and Review-behavior sections.
- [ ] **IA: Review Setup (`02_review_setup.md`) implementation gaps**
	  - Stub exists at `/review/setup`. Needs: temporary session overrides (skip new cards, session size, deck inclusion, card order), session-defaults persistence policy, and a clear "save vs use once" decision per control.
- [ ] **IA: Review Summary (`04_review_summary.md`) implementation gaps**
	  - Post-session reflection screen needs design pass: which performance signals to surface, mistake call-outs, and the "next action" affordances (forward to Insights Mistakes vs. inline drill).
- [ ] **IA: Add Japanese (`06_add_japanese.md`) capture-first flow**
	  - Stub at `/add`. IA principle: capture before deck choice. Wire the input → generated-card-review (`07_…`) → save handoff. No deck selection on the entry surface.
- [x] **IA: Generated Card Review (`07_generated_card_review.md`) — shipped 2026-05-16**
	  - `/add/review` renders `apps/web/app/(app)/add/review/_components/generated-review-client.tsx`. Centered single column (max-w-[760px]) with path-aware header (`校 · Review prepared card` for AI, `確 · Confirm your card` for manual). Compact deck row, flippable card preview that reuses `CardFront`/`CardBack` inside a `SectionCard` with `stripeTone="brand"`, "Build the back of your card" field stack with inline `Try another sentence` / `Try another mnemonic` regenerate links on AI fields, `Advanced` disclosure for part of speech / pitch accent / tags, card-type chooser anchored above Save with live `Save N cards` copy. Save gated on a blockers list (definition, deck, ≥1 card type, sentence-contains-word). Success state replaces the page with `済 · Saved` + Add another / Return to Today / Open cards. Follow-ups: real mnemonic regen (needs a saved card id), image generation, per-field error callouts.
- [ ] **IA: Cards browser (`09_cards.md`)**
	  - Stub at `/cards`. Needs: search, filters, saved views, mass tagging, bulk actions, cross-deck operations. Largest greenfield IA surface remaining.
- [ ] **IA: Card Detail (`10_card_detail.md`)**
	  - Stub at `/cards/[cardId]`. Needs: fields, generated card types, history, scheduling, tags, quality status, repair entry point.
- [ ] **IA: Deck Detail (`11_deck_detail.md`)**
	  - Existing `/decks/[id]` predates the new IA. Needs: deck health, review-load summary, deck-specific cards list, deck options (defaults, retention target), deck-level study actions.
- [ ] **IA: Deck Preview (`12_deck_preview.md`)**
	  - Stub at `/decks/[id]/preview`. Premade-deck inspection page: sample cards, included fields, estimated review load, scope, subscribe.
- [ ] **IA: Insights surfaces (`13`-`17`)**
	  - Overview (`/insights`), Mistakes (`/insights/mistakes`), Progress (`/insights/progress`), Forecast (`/insights/forecast`), Statistics (`/insights/statistics`) all have stubs. Each needs its content surfaces matched to the IA spec — particularly the "interpret before visualize" rule from `13_insights_overview.md`.
- [ ] **IA: First-Time Experience (`19_first_time_experience.md`)**
	  - Value-first onboarding path: short explanation, sample review, account creation, JLPT target, premade deck selection. Coordinate with the existing onboarding flow (`apps/web/app/onboarding/`).
- [ ] **IA: Offline and Error States (`20_offline_error_states.md`)**
	  - Cross-product state guidance. Today's `OfflineStatusBand` is wired; the rest of the product needs the same vocabulary applied (recoverable errors, safe-failure copy, sync reassurance) across Review, Add, Decks, Cards.
- [ ] **Mobile bottom-nav alignment**
	  - IA recommends mobile bottom-nav: Today / Add / Review / Decks / Insights. Verify `apps/web/app/(app)/_components/top-bar.tsx` + mobile drawer match the IA's mobile nav decision; if not, file the mismatch as either a code fix or an IA revision.
- [ ] **Sidebar nav alignment**
	  - Desktop sidebar should show: Today / Add / Decks / Cards / Insights / Settings (per `00_sitemap.md` §Recommended Desktop Navigation). Verify `_components/sidebar.tsx` and reconcile.

## In Progress

- [ ] **Review Session (`03_review_session.md`)**
	  - Existing `/review/session` predates the new IA. Audit against the spec: large centered cards, minimal chrome, no hints, keyboard support, card-type-specific layouts. File deltas per surface.
- [ ] **Decks (`08_decks.md`)**
	  - Existing `/decks` page predates the new IA. Needs: study-collection hub framing, premade decks, deck health, scheduling defaults, deck-level actions.

## Done
- 
- [x] **Today page redesign (`01_today.md`)**
  - Active. Practice-launchpad framing (greeting + hero + week-ahead strip + exit links), card-stack identity, draggable dev tools, offline status band, full hero variant matrix wired through preview controls.
  - Files: `apps/web/app/(app)/today/` (page + `_components/`).
  - Open: production-grade wiring of all six hero variants against live data, copy variants for overdue + severe-backlog, no-reviews-due state polish.
- [x] **App Router IA migration phase 1 (2026-05-14)**
	  - `/dashboard` → `/today`, `/analytics` → `/insights`, `/decks/browse` removed, `/profile` removed, card detail hoisted to `/cards/[cardId]`, `/review` staging moved under `/review/setup`. Stubs scaffolded for `/add`, `/add/review`, `/cards`, `/cards/[cardId]/repair`, `/decks/[id]/preview`, `/insights/{mistakes,progress,forecast,statistics}`.
- [x] **IA wireframe set published**
	  - 21 documents in `docs/information_architecture/` (`00_sitemap.md` plus `01_today.md` through `20_offline_error_states.md`) define page purpose, content hierarchy, primary user jobs, UX notes, UI notes, navigation structure, and per-state guidance for every screen in the product.
- [x] **Sitemap with rationale**
	  - `00_sitemap.md` documents primary navigation, why Decks and Cards are separated, why Review is not a desktop nav item, why Insights has both Overview and Statistics, plus global UX principles.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":false}
```
%%
