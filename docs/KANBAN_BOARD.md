---

kanban-plugin: board

---

Source for status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), refreshed 2026-05-14.

## To Do

- [ ] **Onboarding deck recommendations API**
	  - Add `/onboarding/recommendations` referenced by `apps/web/app/onboarding/decks/page.tsx`.
	  - Wire selected decks through `/api/v1/premade-decks/:id/subscribe`.
- [ ] **Premade deck update / merge workflow**
	  - Surface `premade_decks.version > last_seen_version` and merge new content while preserving user FSRS state.
- [ ] **Leeches frontend wiring**
	  - Backend is done (Stages 1–8). Build the drill UI, dashboard leeches card, `hasLeeches` signal, and diagnosis surface.
	  - Spec: [Add Leeches List and Drill Support](Add%20Leeches%20List%20and%20Drill%20Support.md).
- [ ] **Dashboard backend contracts**
	  - Add deck rollup endpoint (due / new / review / mastery / last-reviewed).
	  - Replace remaining placeholder dashboard surfaces with explicit contracts.
- [ ] **Tomo daily note API**
	  - `GET /api/v1/tomo/note` — single free MVP variant (AI insight + curated idiom fallback).
- [ ] **Sentence-layout card workflow**
	  - Commit a concrete contract for sentence `fields_data` (creation, validation, review behavior).
- [ ] **Persist review personal-best records**
	  - Replace the `localStorage` placeholder with a user-scoped persistence model.
- [ ] **Launch-size premade catalogue** — content work; expand JLPT + Joyo + grammar coverage beyond starter seeds.
- [ ] **Frontend test coverage** — pick a runner; cover review / onboarding / premade-browse / analytics flows.
- [ ] **Legal pages** — Privacy Policy + ToS.
- [ ] **App-level system pages** — verify `not-found.tsx`, `error.tsx`, loading states across shells.
- [ ] **Morphological parsing tokens** — canonical storage + parser pipeline for tokenized Japanese morphology.
- [ ] **Public brand landing page** — replace the `app/page.tsx` redirect with a designed brand surface.
- [ ] **Public SEO + installability** — `app/manifest.ts`, maskable icons, JSON-LD, expanded `sitemap.ts`.
- [ ] **Full frontend CSP nonce policy** — extend the current `frame-ancestors`-only CSP once Next nonce handling is designed.


## In Progress

- [ ] **Design-system migration** — finish moving UI to [DESIGN.md](DESIGN.md) tokens + custom icons; retire `lucide-react`.
- [ ] **Resolve design implementation drift** — fix drift on touch; reserve broad cleanup for a focused pass.
- [ ] **Home / decks / masthead polish** — deck-list styles, My Decks layout, masthead background, analytics nav icon.
- [ ] **Settings V3 + Profile redesign**
	  - Kanji-led sticky rail (人 学 帳 鍵), hybrid auto-save / explicit-save, custom `TomoSlider` + `TomoSelect`, inline delete-account re-auth.
	  - `/profile` ships six dev-toggleable card variants; production default is `stack`.
- [ ] **Remove visible AI wording** — outcome-based copy (create / suggest / draft) replaces `Generate with AI` labels; keep AI terms in internal code/docs.
- [ ] **Premade decks onboarding polish** — backend exists; onboarding still uses placeholder recommendations.
- [ ] **Japanese metadata surfaces** — schemas support pitch accent / frequency / collocations / kanji breakdown; fill missing UI workflows.


## Review

- [ ] **Verify custom system-page coverage** — confirm broad `error.tsx` / `not-found.tsx` / loading coverage before promoting to Done.


## Deferred

- [ ] **Future settings expansion ideas**
	  - **Lens:** every setting carries a cost (cognitive load, code paths, support questions). Only add when a single default cannot serve user variance.
	  - **Filter:** candidates must (a) personalize the practice algorithm, (b) personalize AI voice, or (c) honor privacy/agency. Fit inside an existing tab before adding a new one.
	  - **Profile tab candidates:** public-profile visibility toggle, default deck for new cards, pitch accent + romaji display.
	  - **Learning tab candidates:** per-modality enablement (highest-value next add), furigana density, learner-controlled leech threshold, rating button style.
	  - **Security tab candidates:** 2FA (TOTP/magic-link), recent sign-in activity list.
	  - **Potential new tabs:** Notifications (daily reminder, weekly recap), AI (tone, explanation length), Data & Privacy (export, opt-outs), Account (email change, billing, SSO).
	  - **Ranked next picks:** (1) Notifications, (2) per-modality enablement, (3) public-profile visibility, (4) data export.
	  - **Trap:** a "Display" tab — most options are OS-level (`prefers-color-scheme`, `prefers-reduced-motion`); shipping it signals distrust of system settings.


## Done

- [x] **Canonical documentation cleanup** — product, design, database truth pinned to `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/DATABASE.md`.
- [x] **Auth and account management** — signup, OTP, login, refresh, logout, password change, account deletion.
- [x] **Profile preferences and interests** — profile CRUD, study preferences, JLPT target, daily limits, timezone, interests.
- [x] **Deck and card API** — CRUD, AI + manual creation, semantic similarity, embedding regeneration, idempotency, optimistic concurrency.
- [x] **Premade deck backend** — browse, subscribe, unsubscribe, self-healing.
- [x] **FSRS review engine** — due queue, submit, batch, forecast, session summary, rollback/forget/reschedule, leech flagging.
- [x] **AI generation endpoints** — cards, sentences, mnemonics with prompt sanitization, structured-output validation, response caching.
- [x] **Analytics backend + UI** — heatmap, accuracy, JLPT gap, milestones, review forecast, bundled dashboard. Streaks removed in Stage 8.
- [x] **Core frontend app shell** — auth, onboarding, dashboard, decks, premade browse, review, summary, analytics, settings, profile.
- [x] **Offline review queue** — failed submissions queued locally and replayed through the batch endpoint.
- [x] **API + shared-schema test coverage** — API unit + integration tests, shared auth schema tests.
- [x] **Leeches list + detail (Stage 1)** — `GET /api/v1/leeches` (filters, sorts, tuple cursor) and `GET /:id`; orphan leeches preserved via LEFT/INNER join switching. Commit `81a0b35` (2026-05-14).
- [x] **Leeches resolve + reopen (Stage 2)** — idempotent flips; partial-unique-index 23505 → HTTP 409 `LEECH_ALREADY_OPEN`.
- [x] **Leeches list spec-alignment patch (Stage 2.5)** — added `deckOrder` sort + `diagnosis: available | missing` filter.
- [x] **Drill session creation + snapshot (Stage 3)** — `POST /api/v1/leeches/drill-sessions` with `Idempotency-Key`; two new tables + SECURITY DEFINER RPC; zero FSRS writes.
- [x] **Drill session resume + stale detection (Stage 4)** — `GET /:sessionId` returns the queue + `isCanonicalStateStale` + `staleCards`; shared `compute_card_state_fingerprint_v1` helper with migration-time self-test.
- [x] **Drill attempts + scheduler-invariance suite (Stage 5)** — `POST /:sessionId/attempts`; anti-fraud composite FK; `eventId` as the DB-level idempotency contract; 200-iteration property suite proves no `cards`/`review_logs` writes from the drill path.
- [x] **Drill session lifecycle + source expansion (Stage 6)** — `/finish` + `/abort` (idempotent, terminal one-way); five source values wired via four-branch `UNION ALL`; backend feature-complete.
- [x] **Coding-standards fix-up on diagnose (Stage 7.1)** — `withIdempotency` + strict empty-body schema + parallelized fetches + versioned cache key on `/diagnose`.
- [x] **Free MVP completion + AI leech diagnosis (Stage 7)** — paid/free tier model removed; `POST /:id/diagnose` ships free; diagnose service writes only `leeches.diagnosis` + `leeches.prescription`.
- [x] **Remove legacy streaks + expose rollback/forget/reschedule (Stage 8)**
	  - Migration `20260604000000_remove_legacy_streaks.sql` drops `get_streak(uuid)` and rebuilds `get_dashboard_data` without streak.
	  - **BREAKING:** `ApiAnalyticsDashboardSchema.streak` removed end-to-end (backend + shared-types + frontend `StreakCard`).
	  - Newly exposed `POST /reviews/:reviewLogId/rollback`, `POST /cards/:id/forget` (optional `{ resetCount }`), `POST /cards/:id/reschedule` — all `withIdempotency`-wrapped, `.strict()` schemas, reusing existing service errors.

%% kanban:settings
```
{"kanban-plugin":"board","lane-width":800}
```
%%
