---

kanban-plugin: board

---

Source for status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), refreshed by code inspection on 2026-05-14.

## To Do

- [ ] **Wire onboarding deck selection to real premade subscriptions**
	  - Replace hardcoded starter deck recommendations in `apps/web/app/onboarding/decks/page.tsx`.
	  - Add the `/onboarding/recommendations` endpoint referenced by the onboarding deck-step comment.
	  - Subscribe selected decks through `/api/v1/premade-decks/:id/subscribe`.
- [ ] **Build premade deck update and merge workflow**
	  - Surface `premade_decks.version > last_seen_version`.
	  - Preserve user FSRS state while syncing new or corrected premade content.
- [ ] **Add AI leech diagnosis workflow**
	  - Generate and persist `leeches.diagnosis` and `leeches.prescription`.
	  - Surface guidance in review summary or leech views without visible AI chrome.
	  - Issue type: documentation accuracy and implementation mismatch.
	  - Current mismatch: [DATABASE.md](DATABASE.md) describes async leech diagnosis and prescription population, while the implementation currently supports leech flagging without the diagnosis pipeline.
	  - Done when a concrete service/API path populates diagnosis and prescription data, or the database documentation is explicitly revised to describe the implemented behavior.
- [ ] **Add leeches list and drill support — frontend wiring**
	  - Wire the dashboard leeches card, drill entry point, and a `hasLeeches` signal to the new endpoints.
	  - Build the drill UI (focused-practice screen, session resume, attempt submission, finish/abort buttons).
	  - Wire the diagnosis surface — call `POST /api/v1/leeches/:id/diagnose`, render the returned diagnosis + prescription in the leech details panel.
	  - Spec: [Add Leeches List and Drill Support](Add%20Leeches%20List%20and%20Drill%20Support.md).
	  - **Backend is fully complete** — Stages 1 (list + detail), 2 (resolve + reopen), 2.5 (spec-alignment patch), 3 (drill session creation + snapshot), 4 (drill session resume + stale detection), 5 (drill attempts + scheduler-invariance suite), 6 (session lifecycle + source expansion), and 7 (free MVP completion + AI diagnosis) are all shipped.
- [ ] **Finish dashboard backend-backed state**
	  - Add or derive weekly review and retention summary data only if a current dashboard surface needs it.
	  - Keep recent activity derived from heatmap data unless a dedicated endpoint becomes necessary.
	  - Add dashboard deck rollups including due, new, review, total, mastery, and last-reviewed data.
	  - Coordinate with the leeches list and the later Tomo daily note card so dashboard sections read from explicit backend contracts.
	  - Issue type: implementation placeholder and data-contract gap.
	  - Current state: hero, forecast, basic deck shelf, and recent activity use live data; leeches and the temporary practice signal render unavailable states; dev-only preview controls still use sample data by design.
	  - Recommended action: define the missing leech, deck-rollup, and note contracts before replacing unavailable states.
	  - Done when deck rollups, leech signals, and the restored Tomo daily note surface are no longer backed by unavailable/demo data.
- [ ] **Build Tomo daily note API and content source**
	  - Add a route family such as `GET /api/v1/tomo/note`.
	  - For the MVP, ship a single free variant (no tier-based variants). AI-generated insight and curated idiom fallback both available to every learner; the rate limiters handle cost control.
	  - Add a curated idiom source and cache AI insight output safely.
	  - The current dashboard practice-signal module is temporary; restore the dashboard area back to Tomo daily notes when this API lands.
- [ ] **Define sentence-layout card workflow**
	  - Replace the open, reserved sentence `fields_data` shape with a committed contract.
	  - Add creation, validation, rendering, and review behavior for sentence-layout cards.
	  - Issue type: domain workflow gap.
	  - Current mismatch: schema and shared types allow sentence-layout cards, but the product behavior is not yet committed beyond the data shape.
	  - Done when sentence cards have a documented and implemented contract for required fields, validation errors, creation flow, review answer behavior, and migration/backfill expectations.
- [ ] **Persist review personal-best records**
	  - Replace the review-summary `localStorage` placeholder with durable user-scoped persistence.
	  - Keep the current client-side comparison behavior until server storage exists.
	  - Issue type: cross-device persistence gap.
	  - Recommended action: add a small user-scoped stats endpoint or persistence model before removing the current client comparison.
	  - Done when review personal-best values survive logout, browser change, and device change.
- [ ] **Complete launch-size premade catalogue**
	  - Expand beyond starter seed content for JLPT vocabulary, Beyond JLPT, Joyo kanji, and grammar coverage.
- [ ] **Add frontend test coverage**
	  - Define the web test runner.
	  - Cover review, onboarding, premade deck browse, and analytics flows.
- [ ] **Add legal pages**
	  - Build Privacy Policy and Terms of Service pages.
- [ ] **Add app-level system pages**
	  - Add or verify `not-found.tsx`, `error.tsx`, and loading states across public and protected shells.
- [ ] **Add morphological parsing tokens**
	  - Define canonical storage and shared contracts for tokenized Japanese morphology.
	  - Build the parser pipeline that populates tokens and parse timestamps.
	  - Integrate parsed tokens into Japanese-aware card, sentence, or lookup workflows.
- [ ] **Build public brand landing page**
	  - Replace the temporary `apps/web/app/page.tsx` redirect with a designed public brand surface.
	  - Follow [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) brand-surface rules.
	  - Preserve clear paths into signup, login, and onboarding.
- [ ] **Add public SEO and installability surfaces**
	  - Add `app/manifest.ts`, maskable icons, and monochrome icon variants.
	  - Add dynamic deck Open Graph images when public deck URLs exist.
	  - Add Organization and SoftwareApplication JSON-LD on the public surface.
	  - Expand `sitemap.ts` with public routes such as features, pricing, privacy, and help.
- [ ] **Add full frontend CSP nonce policy**
	  - Replace the current `frame-ancestors`-only CSP with script/style CSP once Next.js nonce handling is designed.
	  - Keep existing clickjacking, MIME sniffing, referrer, and permissions headers.


## In Progress

- [ ] **Product design-system migration**
	  - Continue migrating UI toward [DESIGN.md](DESIGN.md) tokens, custom icons, and Tomo brand.
	  - Retire remaining legacy `lucide-react` usage and dependency when no components need it.
	  - Rebuild the custom navigation/account icon set referenced by the placeholder registry comments.
- [ ] **Resolve design implementation drift**
	  - Track UI areas that diverge from [DESIGN.md](DESIGN.md), including mixed icon systems, Japanese rendering paths, card treatment, shadows, spacing, and button patterns.
	  - Treat this as an active migration checklist instead of scattered unrelated fixes.
	  - Recommended action: fix drift when touching the relevant component, and reserve broad cleanup for a focused design-system pass.
	  - Done when the remaining app surfaces consistently follow the established design tokens, component patterns, and brand rules.
- [ ] **Home, decks, masthead, and navigation visual polish**
	  - Decide whether the learner date belongs on the home/dashboard masthead or in sidebar/navigation chrome.
	  - Edit deck-list styles on the home/dashboard page so active deck summaries match the current design-system direction.
	  - Refine the My Decks page layout, states, and visual treatment.
	  - Replace the current masthead background illustration.
	  - Change the analytics navigation icon to the updated custom mark.
	  - Done when the home/dashboard page, My Decks page, and navigation reflect the decision and [status/FRONTEND.md](status/FRONTEND.md) no longer lists these as pending drift.
- [ ] **Settings V3 and Profile redesign**
	  - Settings refactored to a kanji-led sticky rail (人 Profile, 学 Learning, 帳 Account, 鍵 Security) with four peer sections, each wrapped in a `SectionCard` matching the dashboard hero visual register (Warm Paper Raised, 2px Inari Vermillion top edge, 1px Soft Hairline border, 2px corners, no shadow).
	  - Hybrid save model: auto-save sliders/pills/dropdowns; explicit save for text identity fields with section-foot "Save changes" button. Inline ink-tick feedback (`✓ saved` beside the label) replaces the corner toast. 1px Inari Vermillion dirty gutter on uncommitted explicit-save fields.
	  - Custom brand-native primitives: `TomoSlider` (div-based, role=slider, full ARIA, keyboard nav, value readout pill, onValueChange/Commit split) and `TomoSelect` (combobox + listbox popover via createPortal, full ARIA, keyboard nav, type-to-search). Both live in `apps/web/components/ui/` and are reusable across the app.
	  - Delete-account flow moved from modal dialog to inline re-auth unfold under the Security section.
	  - `/profile` route ships six card-based direction variants behind a rebuilt floating dev toolbar (Stack / Solo / Bento / Roll / Postcard / Float). Each is a different organizing principle: layered, centered single, hero plus asymmetric bento, identity card plus sidebar roll, single wide card with internal columns, asymmetric float. Production default is `stack` (the V3-locked Card-Stack Portrait). All variants are honest about MVP data: no stub stats, only display name + JLPT target + joined month + 友 seal-mark.
	  - Done when the surfaces are visually confirmed in-browser at mobile / tablet / desktop widths and the optional billing/email-change TODOs in Account are tracked separately or scoped in.
- [ ] **Remove visible AI wording from user-facing surfaces**
	  - Replace UI labels such as `Generate with AI` with outcome-based wording like create, suggest, draft, or explain.
	  - Remove or revise public metadata wording such as `AI-enhanced` where it makes AI a visible product promise.
	  - Keep AI terminology available for internal docs, route names, code, and diagnostics where it is technically useful.
	  - Done when core user-facing copy follows the invisible-AI brand rule without changing the underlying AI features.
- [ ] **Premade decks and onboarding polish**
	  - Backend browse/subscribe paths exist.
	  - Onboarding still uses placeholder recommendations and does not subscribe selected premade decks.
- [ ] **Japanese metadata surfaces**
	  - Shared field schemas support pitch accent, frequency rank, collocations, and kanji breakdown.
	  - Verify and fill missing specialized UI workflows.


## Review

- [ ] **Decide public exposure for rollback / forget / reschedule**
	  - Service functions exist in `fsrs.service.ts`.
	  - Decide whether to add user-facing API/UI routes or mark them internal-only.
- [ ] **Revisit streaks for a later version**
	  - Streak UI is intentionally deferred from the current dashboard and analytics scope.
	  - Legacy backend streak RPC/API may remain for compatibility until a later product pass decides whether to remove, replace, or make it learner-timezone-aware.
	  - If current scope must be fully streak-free, remove the remaining analytics `StreakCard` and any streak copy from `apps/web/app/(app)/analytics/_components/`.
- [ ] **Verify custom system-page coverage**
	  - Static inspection found route pages and layouts.
	  - Confirm broad `error.tsx`, `not-found.tsx`, and loading coverage before moving the system-pages card to Done.

## Deferred

- [ ] **Future settings expansion ideas**
	  - Selection lens: every setting carries a "settings cost" (cognitive load, code paths, new-user decisions, support questions). Only add a setting when user belief or behavior varies enough that a single default cannot serve it.
	  - Tomo-specific filter: candidates should earn their slot via one of (a) personalization of the practice algorithm, (b) personalization of the AI's voice, (c) honoring privacy/agency. Fit candidates inside an existing tab before justifying a new tab. Three tabs is calm; five starts to look like an admin panel.
	  - Candidates inside the existing **Profile** tab:
		- Public profile visibility toggle (gates the upcoming `decks.is_public` rollout). Optionally split into "show my profile", "show my shelf", "show my cadence".
		- Default deck for new cards (single dropdown).
		- Pitch accent + romaji display (yes/no each).
	  - Candidates inside the existing **Learning** tab:
		- Per-modality enablement (comprehension / production / listening). Per-modality FSRS already exists in code; users currently cannot reach it. Highest-value next addition.
		- Furigana density rule (always / JLPT-aware / never).
		- Leech threshold (move `LEECH_THRESHOLD` from env to a user-controllable field, behind a "Show advanced" disclosure).
		- Rating button style (4-button Again/Hard/Good/Easy vs. simplified 2-button).
	  - Candidates inside the existing **Security** tab:
		- Two-factor authentication (TOTP or magic-link).
		- Recent sign-in activity list ("Tokyo · Chrome · 2 hours ago" rows below Sign out everywhere).
	  - Candidate **new tabs** (only if mass justifies a slot):
		- **Notifications**: daily reminder time, weekly recap email, streak warnings, channels (email/push/none). Largest current UX gap; the "morning ritual" brand voice asks for this.
		- **AI**: explanation length (terse / standard / detailed), tone (teacherly / casual), auto-generate mnemonics yes/no, auto-generate example sentences yes/no, "always show English translation" toggle.
		- **Data & privacy**: export cards (CSV / Anki package), export review history, analytics opt-out, AI training opt-out. Anki refugees specifically look for this before committing.
		- **Account** (the reserved 帳 kanji returns): sign-in email change, plan + manage billing, linked accounts (Apple/Google SSO), API tokens.
	  - Ranked next-ship picks: (1) Notifications, (2) per-modality enablement inside Learning, (3) public profile visibility inside Profile, (4) data export under a new Data & privacy tab.
	  - **Trap to avoid**: a "Display" tab with theme / font / contrast / motion toggles. Most are system-level preferences (`prefers-color-scheme`, `prefers-reduced-motion`) the app should honor automatically. A Display tab signals distrust of OS settings for low return.

## Done

- [x] **Canonical documentation cleanup**
	  - Product, design, and database truth live in `docs/PRODUCT.md`, `docs/DESIGN.md`, and `docs/DATABASE.md`.
	  - Current implementation status index lives in `docs/IMPLEMENTATION_STATUS.md`.
- [x] **Auth and account management**
	  - Signup, cancel-signup, login, refresh, OTP verify/resend, logout, password change, and account deletion routes exist.
- [x] **Profile preferences and interests**
	  - Profile get/update, study preferences, JLPT target, daily limits, timezone, and normalized interests are implemented.
- [x] **Deck and card API**
	  - User deck CRUD, card CRUD, AI/manual card creation, semantic similarity, embedding regeneration, pagination, idempotency, and optimistic concurrency are implemented.
- [x] **Premade deck backend**
	  - Browse, subscribe, unsubscribe, subscription listing, and self-healing subscribe behavior are implemented.
- [x] **FSRS review engine**
	  - Due queue, review submit, batch submit, forecast, session summary, rollback/forget/reschedule services, and leech flagging are implemented.
- [x] **AI generation endpoints**
	  - Card generation, contextual sentences, mnemonics, prompt sanitization, structured output validation, and response caching are implemented.
- [x] **Analytics backend and UI**
	  - Heatmap, accuracy, JLPT gap, milestone forecast, review forecast, and bundled dashboard paths exist. Streaks are deferred from the current product scope.
- [x] **Core frontend app shell**
	  - Auth, onboarding, dashboard, decks, premade browse, review, review summary, analytics, settings, and profile routes exist.
- [x] **Offline review queue**
	  - Failed review submissions are queued locally and replayed through the batch endpoint.
- [x] **API and shared-schema test coverage**
	  - API unit tests, API integration tests, and shared auth schema tests exist.
- [x] **Leeches list and detail endpoints (Stage 1)**
	  - `GET /api/v1/leeches` with status/deck/JLPT/cardType filters, three sort modes, and `(created_at, id)` tuple cursor pagination.
	  - `GET /api/v1/leeches/:id` returns the full joined card+deck context.
	  - LEFT/INNER join switching keeps orphan leeches (card_id NULL) visible in history while excluding them from filtered queries.
	  - Shipped 2026-05-14 in commit `81a0b35`.
- [x] **Leeches resolve and reopen endpoints (Stage 2)**
	  - `POST /api/v1/leeches/:id/resolve` — idempotent flip with COALESCE-style "preserve original resolved_at" semantics.
	  - `POST /api/v1/leeches/:id/reopen` — translates SQLSTATE 23505 from the partial unique index `leeches_card_user_unresolved_idx` to HTTP 409 `LEECH_ALREADY_OPEN`.
	  - No FSRS state touched; both endpoints inherit auth + `defaultUserRateLimitMiddleware`.
- [x] **Leeches list spec-alignment patch (Stage 2.5)**
	  - Added `deckOrder` to `leechSortEnum` and the `diagnosis: available | missing` filter to `listLeechesQuerySchema`, closing the two gaps the updated spec surfaced.
	  - Cursor pagination remains restricted to time-keyed sorts; `deckOrder` is top-N only (same constraint as `mostLapses`) until an RPC lifts it.
	  - The spec's third `diagnosis` arm `'not included in plan'` was a tier signal — Stage 7 removed the tier model, so the enum stays at `available | missing`.
- [x] **Leech drill session creation + snapshot (Stage 3)**
	  - `POST /api/v1/leeches/drill-sessions` builds a persisted, focused drill queue gated by `Idempotency-Key` so network retries can't mint duplicate sessions.
	  - Two new tables (migration `20260531000000_leech_drill_sessions.sql`): `leech_drill_sessions` (envelope) and `leech_drill_session_cards` (per-card baseline_* FSRS snapshot + versioned `v1:` canonical_state_fingerprint).
	  - One SECURITY DEFINER RPC (`create_leech_drill_session`), GRANTed to `service_role` with pinned `search_path`. Selects candidates, inserts the session, inserts N snapshots — all in one transaction.
	  - Composite `UNIQUE (id, session_id)` on `leech_drill_session_cards` reserves the FK Stage 5's `leech_drill_attempts` will use to make cross-session attempt forgery structurally impossible.
	  - Strict scheduler invariance: the RPC's body contains zero UPDATE/DELETE against `cards` or `review_logs`; the service does not import `fsrs.service.ts`.
- [x] **Leech drill session resume + stale detection (Stage 4)**
	  - `GET /api/v1/leeches/drill-sessions/:sessionId` returns the queue plus `isCanonicalStateStale` and `staleCards`; per-row `isStale` and `isOrphaned` flags let the client render orphan and stale states without join-back logic.
	  - Extracted the fingerprint formula into a shared `IMMUTABLE` helper `compute_card_state_fingerprint_v1` so create and resume cannot drift. Migration `20260601000000_leech_drill_session_resume.sql` includes a `DO $$ ... $$` self-test asserting the helper's output against a fixed test vector — any future edit that would invalidate existing sessions' stored fingerprints causes the migration to RAISE at apply time.
	  - `CREATE OR REPLACE create_leech_drill_session` now calls the helper instead of an inline expression. Token-equivalent formula preserves byte-for-byte fingerprint compatibility.
	  - One new RPC `get_leech_drill_session` (SECURITY DEFINER, `search_path = ''`, GRANT to `service_role`). One LEFT JOIN scan + `jsonb_agg(...) FILTER (...)` returns the full envelope in one pass. Reads only — no writes to `cards` or `review_logs`.
	  - New error code: 404 `LEECH_DRILL_SESSION_NOT_FOUND` registered in the canonical block.
- [x] **Leech drill attempts + scheduler-invariance suite (Stage 5)**
	  - `POST /api/v1/leeches/drill-sessions/:sessionId/attempts` records immutable per-answer events.
	  - New table `leech_drill_attempts` (migration `20260602000000_leech_drill_attempts.sql`) consumes Stage 3's reserved composite `UNIQUE (id, session_id)` via the anti-fraud FK `FOREIGN KEY (session_card_id, session_id) REFERENCES leech_drill_session_cards`. Cross-session attempt forgery is structurally impossible at the database layer.
	  - `eventId` is the authoritative idempotency identifier; `INSERT ... ON CONFLICT (user_id, event_id) DO NOTHING` + replay-fetch gives exactly-once delivery without HTTP-level `Idempotency-Key` machinery. The DB unique IS the contract.
	  - Body-side `cardId`/`leechId` are treated as consistency assertions — mismatches against the canonical session-card values RAISE and translate to HTTP 422 `LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH`. The wire INSERT always uses the canonical values from `leech_drill_session_cards`, never the body's.
	  - Two new error codes: 404 `LEECH_DRILL_SESSION_CARD_NOT_FOUND` and 422 `LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH`.
	  - **Property-based scheduler-invariance test suite** (200 randomized iterations across all three drill endpoints) proves the drill code path never reads or writes `cards` or `review_logs`. The suite is the load-bearing CI guard against accidental FSRS leakage from any future drill-service refactor.
- [x] **Leech drill backend completion: session lifecycle + source expansion (Stage 6)**
	  - `POST /api/v1/leeches/drill-sessions/:sessionId/finish` and `/abort` finally turn the `status` column from decorative into transitionable. Idempotent on no-op retries (re-finishing preserves the original `finished_at`); rejects illegal transitions (terminal states are one-way) with 409 `LEECH_DRILL_SESSION_STATE_CONFLICT`.
	  - `create_leech_drill_session` RPC extended (migration `20260603000000_drill_session_lifecycle_and_sources.sql`) with three new parameters (`p_card_ids`, `p_card_id`, `p_min_lapses`) and a four-branch `UNION ALL` candidate CTE. All five spec source values (`unresolvedLeeches`, `deckScoped`, `highLapseCandidates`, `manualSelection`, `currentCard`) are now wired through.
	  - The Stage 4 fingerprint helper is unchanged — same byte-for-byte output, existing sessions' stored hashes stay valid.
	  - New SECURITY DEFINER RPC `transition_leech_drill_session` (RETURNS void; service does a follow-up `get_leech_drill_session` for the post-state envelope so the wire shape stays identical to Stage 4's GET response). `FOR UPDATE` lock guards against concurrent transitions.
	  - 22 new unit tests including extension of the property-based scheduler-invariance suite to cover `transitionDrillSession` and all five `createDrillSession` source values.
	  - **Backend is feature-complete** for everything except AI diagnosis (Stage 7 added that) and the optional `leech_drill_card_states` aggregate (deferred, no consumer surface).
- [x] **Free MVP completion + AI leech diagnosis (Stage 7)**
	  - Removed the paid/free tier model entirely. For the MVP release, every Tomo feature is available to every authenticated learner. Code paths no longer reference any entitlement; rate limiters are the only cost-control mechanism.
	  - `POST /api/v1/leeches/:id/diagnose` ships as a free MVP endpoint. Builds prompt context from card content + recent review-log ratings + lapse count + learner profile (JLPT target, native language). Replay-on-existing semantics: a leech already populated with diagnosis returns the stored values without re-calling OpenAI; clients regenerate by resolving+reopening the leech.
	  - New shared-types schema `GeneratedLeechDiagnosisSchema` + service function `generateLeechDiagnosis` follow the same Redis-cache + OpenAI-breaker + sanitization pattern as existing AI endpoints. Cache key includes lapse pattern so the diagnosis can adapt as a card gets worse.
	  - Scheduler invariance preserved: the diagnose service writes ONLY `leeches.diagnosis` and `leeches.prescription`. It does not mutate `cards` FSRS state or insert into `review_logs`. A new test asserts the single `.update()` call's patch keys are exactly `['diagnosis', 'prescription']`.
	  - 422 `CARD_FIELDS_INSUFFICIENT` for orphan leeches and sentence-layout cards that lack the word/reading/meaning fields the prompt needs. Profile fetch errors fall back to safe defaults (`N5`, `en`) rather than failing the diagnosis.
	  - Documentation revised across `PRODUCT.md`, `PRD.md`, the leech spec doc, and this kanban to drop tier language. The dedicated "Implement paid/free tier entitlement gates" To-Do entry was removed.

%% kanban:settings
```
{"kanban-plugin":"board","lane-width":800}
```
%%
