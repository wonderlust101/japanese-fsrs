---

kanban-plugin: board

---

Source for status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), refreshed by code inspection on 2026-05-13.

## To Do

- [ ] **Wire onboarding deck selection to real premade subscriptions**
	  - Replace hardcoded starter deck recommendations in `apps/web/app/onboarding/decks/page.tsx`.
	  - Add the `/onboarding/recommendations` endpoint referenced by the onboarding deck-step comment.
	  - Subscribe selected decks through `/api/v1/premade-decks/:id/subscribe`.
- [ ] **Implement paid/free tier entitlement gates**
	  - Add a persisted user tier or entitlement model.
	  - Gate paid AI features server-side instead of relying only on auth, rate limits, and daily quota.
	  - Keep free-tier manual SRS, premade decks, analytics, offline review, and accessibility available.
	  - Issue type: business-rule and backend enforcement gap.
	  - Current mismatch: product requirements describe paid AI behavior, but code does not yet expose a durable entitlement source that routes/services can enforce.
	  - Done when paid-only AI paths fail closed for users without entitlement and free-tier paths continue to work without paid entitlement.
- [ ] **Build premade deck update and merge workflow**
	  - Surface `premade_decks.version > last_seen_version`.
	  - Preserve user FSRS state while syncing new or corrected premade content.
- [ ] **Add AI leech diagnosis workflow**
	  - Generate and persist `leeches.diagnosis` and `leeches.prescription`.
	  - Surface guidance in review summary or leech views without visible AI chrome.
	  - Issue type: documentation accuracy and implementation mismatch.
	  - Current mismatch: [DATABASE.md](DATABASE.md) describes async leech diagnosis and prescription population, while the implementation currently supports leech flagging without the diagnosis pipeline.
	  - Done when a concrete service/API path populates diagnosis and prescription data, or the database documentation is explicitly revised to describe the implemented behavior.
- [ ] **Add leeches list and drill support**
	  - Add a leeches-list API such as `GET /api/v1/reviews/leeches?limit=5`.
	  - Expose a `hasLeeches` signal for the dashboard Drill leeches CTA.
	  - Wire the dashboard leeches card and drill entry point to real data.
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
	  - Support paid insight and free/fallback idiom variants as referenced in dashboard comments.
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
	  - Auth, onboarding, dashboard, decks, premade browse, review, review summary, analytics, and settings routes exist.
- [x] **Offline review queue**
	  - Failed review submissions are queued locally and replayed through the batch endpoint.
- [x] **API and shared-schema test coverage**
	  - API unit tests, API integration tests, and shared auth schema tests exist.

%% kanban:settings
```
{"kanban-plugin":"board","lane-width":800}
```
%%
