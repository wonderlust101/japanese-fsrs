---

kanban-plugin: board

---

Source for status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), refreshed 2026-05-17. Detail per area lives under [status/](status/); migration-level detail lives in each `supabase/migrations/*.sql` header.

## To Do

- [ ] **Confusable items frontend (deferred)**
  - `/insights/mistakes` retirement removed `ConfusablePairList`. Reintroduce as a tab inside `/insights/weak-spots` once the per-pair drill is designed.
- [ ] **Flesh out IA stub pages**
  - Only `/cards/[cardId]/repair` and `/decks/[id]/preview` remain as `StubPage`. Tracked per surface in [status/FRONTEND.md](status/FRONTEND.md).
- [ ] **Settings IA: missing sections**
  - Add designs + routes for Display, Data & sync, and Review-behavior tabs (or explicit deferral notes in IA `18_settings.md`).
- [ ] **Onboarding deck recommendations (frontend slice)**
  - Pure frontend: score the existing catalogue against `profile.{jlpt_target, interests}`. Replace the hardcoded `RECOMMENDED_DECKS` constant and route selections through `POST /api/v1/premade-decks/:id/copy`.
- [ ] **Premade "copy to library" — frontend slice**
  - Rename "Subscribe" → "Add to my library", render "From: <premade name>" attribution chip on copies, unify delete-deck copy. Backend shipped 2026-05-17 (Stage 4).
- [ ] **Sweep stale subscription language across docs and wireframes**
  - Replace "subscribe / subscription / lastSeenVersion / version drift" with copy-model language across [TDD.md](TDD.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), `status/*`, and the IA wireframes. Done-column entries stay as historical record.
- [ ] **Weak spots Phase 3 — drill follow-ups**
  - Remaining: dashboard weak-spots card on `/today`, `hasLeeches` signal, "Count this as a review" override inside drill session.
- [ ] **Dashboard backend contracts**
  - Replace remaining placeholder dashboard surfaces with explicit contracts. Deck rollup shipped as Stage 3.
- [ ] **Launch-size premade catalogue** — content work; expand JLPT + Joyo + grammar coverage beyond starter seeds.
- [ ] **Frontend test coverage** — pick a runner; cover review / onboarding / premade-browse / analytics flows.
- [ ] **Legal pages** — Privacy Policy + ToS.
- [ ] **App-level system pages** — add `loading.tsx` skeletons for `/today`, `/review/setup`, `/insights/*`. `error.tsx` + `not-found.tsx` already shipped.
- [ ] **Public brand landing page** — replace the `app/page.tsx` 7-line redirect with a designed brand surface.
- [ ] **Public SEO + installability** — add `app/manifest.ts` + maskable icons + JSON-LD; expand `sitemap.ts`.
- [ ] **Full frontend CSP nonce policy** — extend the current `frame-ancestors`-only CSP once Next nonce handling is designed.

## In Progress

- [ ] **Frontend polish pass (very fine finishes)** — single rolling item for the remaining UI refinement work; tackle in any order, mark sub-items as they land.
  - **Design drift fixes on touch** — no broad sweep; fix whatever's visibly wrong on the surface you happen to be in.
  - **Home / decks / masthead** — deck-list row styles, My Decks layout, masthead background, analytics nav icon.
  - **Settings V3 + Profile redesign** — kanji-led sticky rail (人 学 帳 鍵), hybrid auto-save, custom `TomoSlider`/`TomoSelect`, inline delete-account re-auth.
  - **Remove visible AI wording** — outcome copy (create / suggest / draft) replaces `Generate with AI` labels; internal code/docs terms stay.
  - **Premade onboarding** — replace placeholder recommendations with client-side scoring over the live catalogue (`profile.{jlpt_target, interests}` vs `premade_decks.{jlpt_level, domain}`).
  - **Japanese metadata surfaces** — wire pitch accent / frequency / collocations / kanji breakdown into the existing card-detail / review-back chrome (schemas already carry the fields).

## Review

- [ ] **Verify custom system-page coverage** — confirm broad `error.tsx` / `not-found.tsx` / `loading.tsx` coverage before promoting to Done.

## Done

- [x] **IA wireframe doc cleanup (2026-05-18)** — stray absolute path stripped from `00_sitemap.md`, "Lapis-compatible note" rewritten as "Tomo card note", and the "legacy design system" framing dropped from `03_review_session.md`. Low-risk hygiene pass against the IA wireframes.
- [x] **Collapse `card_type` modality → single FSRS scheduler (2026-05-18)** — migration `20260614000000_drop_card_type.sql` drops `cards.card_type`, the `card_type` enum, and the per-modality scheduler map in `fsrs.service.ts`; one scheduler at `request_retention = 0.85` (matches `profiles.retention_target` default). Bonus: `get_accuracy_by_layout` renamed to `get_accuracy_by_layout_type` and re-pointed at `c.layout_type` (the old name was a misnomer that grouped by `card_type` while exposing the column as `layout`). Closes "Reconcile IA card types with `card_type` schema" — the IA's modality framing in `03_review_session.md` is also restructured around `layout_type` in the same PR.
- [x] **Rename leech → weak spot end-to-end (2026-05-18)** — migration `20260615000000_rename_leeches_to_weak_spots.sql` renames the four DB tables, twelve indexes, and drops + recreates the four drill RPCs (`create_weak_spot_drill_session`, `get_weak_spot_drill_session`, `record_weak_spot_drill_attempt`, `transition_weak_spot_drill_session`). Also recreates `process_review`, `process_review_batch`, `get_session_summary` with renamed table refs because plpgsql function bodies are stored as text and don't re-parse on table rename. Wire-level: `/api/v1/leeches/*` → `/api/v1/weak-spots/*`; `LEECH_ALREADY_OPEN` → `WEAK_SPOT_ALREADY_OPEN`; env var `LEECH_THRESHOLD` → `WEAK_SPOT_THRESHOLD`; wire field `leechId` → `weakSpotId`. Backend files moved: `leech.service.ts`/`leeches.controller.ts`/`leeches.ts` (routes) → `weak-spot.*`/`weak-spots.*`. Frontend: every `Leech*` / `useLeech*` / `Leeches*` export, hook, store, query-key family, Pill tone, and IA wireframe renamed; `ProblemCardRow` → `WeakSpotRow`; `Problem cards` → `Weak spots` everywhere. IA `05_problem_card_repair.md` → `05_weak_spot_repair.md`. Closes "Resolve 'Problem Card' vs 'Weak spot' vocabulary". Follow-ups: regenerate `database.types.ts` via `bun gen:types` to replace the hand-edited copy; the DB CHECK source-value `unresolved_leeches` (internal enum, no learner impact) kept as-is.
- [x] **Sentence-layout AI generator branch (Stage 13, 2026-05-17)** — `mode='ai' layoutType='sentence'` now dispatches to `generateSentenceCard` (separate Redis namespace `sentence-card:v1:…`). Coverage: 6 unit + 2 cache-seeded integration tests. No migration — Stage 12 already shipped the CHECK.
- [x] **Sentence-layout schema contract + CHECK (Stage 12, 2026-05-17)** — closes the open-shape gap. `SentenceFieldsDataSchema` tightened to `{ ja, en, furigana, breakdown?, audio?, nuance? }`; migration `20260612000000_sentence_layout_check.sql` adds the matching DB CHECK via `NOT VALID` + `VALIDATE`. Stage 11 (personal-best persistence) was skipped per user direction.
- [x] **Confusable-items detection (Stage 10, 2026-05-17)** — `GET /api/v1/insights/confusable-pairs`. Migration `20260611000000_confusable_pairs.sql` adds the table, `record_confusable_pairs()` detection, `get_confusable_pairs()` reader, and a defensive 03:00 UTC pg_cron schedule. Thresholds (miss ≥ 2, cosine ≥ 0.70) live inside the RPC.
- [x] **Per-day maturity snapshots (Stage 9, 2026-05-17)** — `GET /api/v1/insights/maturity-history?days=90|180|365`. Migration `20260610000000_card_state_snapshots.sql` adds the snapshot table, `record_card_state_snapshots()` cron job (02:15 UTC), and `get_maturity_pipeline_history()` which always computes today live. Mature = state 2 + scheduled_days ≥ 21 (Anki convention; matches Stage 3).
- [x] **Card-quality issue counts (Stage 8, 2026-05-17)** — `GET /api/v1/insights/card-quality` returns six rows for `missing_{reading,meaning,example,mnemonic,picture,nuance}`. Migration `20260609000000_get_card_quality_issues_rpc.sql`; single-scan `COUNT(*) FILTER (…)` + `LATERAL VALUES` unpivot. Frontend `cards-quality-bars.tsx` uses a different enum — known follow-up.
- [x] **Problem-card list (lapse-bucketed) (Stage 7, 2026-05-17)** — `GET /api/v1/insights/problem-cards?bucket={2-3|4-5|6-7|8plus}`. Migration `20260608000000_get_problem_cards_rpc.sql`. Acceptance: `8plus` cardinality equals the unresolved-weak spot count (integration test pins it).
- [x] **Tomo daily note API (Stage 6, 2026-05-17)** — `GET /api/v1/tomo/note` returns `{ body, kind, dateKey }`. AI path via `generateTomoNote` (`TOMO_NOTE_PROMPT_VERSION='v1'`, 36h Redis TTL); deterministic idiom fallback from `data/idioms.json` keyed by SHA-256 of `(userId, dateKey)` whenever AI fails. No DB migration.
- [x] **Premade "copy to library" migration (Stage 4 — rewritten 2026-05-17, copy model)** — replaces the subscription/fork model with copy-as-starting-point. Migration `20260607000000_premade_copy_model.sql` drops `user_premade_subscriptions`, `subscribe_to_premade_deck`, `unsubscribe_from_premade_deck`, `premade_decks.version`, and `decks.is_premade_fork`; adds `copy_premade_deck(p_user_id, p_premade_deck_id)`. Route: `POST /api/v1/premade-decks/:id/copy` (allows duplicates by design). Frontend rebranding tracked separately.
- [x] **Surface premade `version` + `lastSeenVersion` (Stage 4, 2026-05-17)** — *superseded by the 2026-05-17 copy-model rewrite; the schema fields and route were removed by `20260607000000_premade_copy_model.sql`. Kept as historical record.*
- [x] **Dashboard deck rollup batch (Stage 3, 2026-05-17)** — `GET /api/v1/decks` returns per-deck due/new/mature/due-new/due-review/last-reviewed in one round-trip. Migration `20260606000000_list_decks_paginated_rollups.sql`. Frontend N+1 elimination is opt-in follow-up.
- [x] **AI generator population for Lapis-style fields (Stage 2, 2026-05-17)** — `generateCard` prompt now produces `pitchPosition` + `nuance`; explicitly omits `picture` / `expressionAudio` / `sentenceAudio` (assets the system can't host yet). `CARD_PROMPT_VERSION='v2'` invalidates the old cache.
- [x] **Card content fields for Lapis-style review UI — schema admission (Stage 1, 2026-05-17)** — additive `.nullable().optional()` fields on `WordFieldsSchema` + `ExampleSentenceSchema`: `picture`, `expressionAudio`, `pitchPosition` (int ≥ 0), `nuance`, `sentenceAudio`. No migration — `cards_fields_data_shape` only enforces required keys.
- [x] **Design-system migration — `lucide-react` retired (2026-05-17)** — zero usages remain across `apps/web/{app,components,lib}`. Outstanding: drop the dependency from `package.json` + lockfile.
- [x] **Rename Leeches → Weak spots in user-facing surfaces (2026-05-17)** — route `/insights/leeches/*` → `/insights/weak-spots/*` (via `git mv`); all 25 URL references rewritten; kanji ornament 蛭 → 弱. Internal code (components, hooks, store, query keys) kept `leech*` at the time to stay aligned with `/api/v1/leeches`. *Superseded 2026-05-18 by the full leech → weak spot rename above — all internal identifiers now also use `weakSpot*`.*
- [x] **Retire /insights/mistakes (2026-05-17)** — page deleted after the IA restructure. Card quality bars moved to `/cards` behind a `欠 Card quality` toggle; pattern summary + problem-cards bars removed as redundant; confusables deferred; weak spots mini-list canonicalized at `/insights/weak-spots`.
- [x] **Weak spots Phase 2 — Drill flow (2026-05-17)** — full drill experience under `/insights/weak-spots/drill/{setup,[sessionId],[sessionId]/summary}`. Bespoke 3-channel `DrillRatingBar` (Missed/Hesitated/Remembered); `useWeakSpotDrillSessionStore` (Zustand, renamed from `useLeechDrillSessionStore` in the 2026-05-18 sweep); scheduler-invariance honored. Phase 3 deferred: dashboard surface + "Count this as a review" override.
- [x] **Weak spots sidebar entry + unresolved-count badge (2026-05-17)** — `useUnresolvedWeakSpotCount()` projection over `useWeakSpotsQuery` (both renamed from `useUnresolvedLeechCount` / `useLeechesQuery` in the 2026-05-18 sweep); vermillion-stroked count chip capped at 50. Other nav rows pay zero subscription cost.
- [x] **Weak spots Phase 1 — List + Detail + Diagnosis (2026-05-17)** — `/insights/leeches` (renamed to `/insights/weak-spots` on the same day, internal identifiers renamed on 2026-05-18) lists unresolved/resolved weak spots with six filter dimensions; per-row Drill / View / Resolve actions; detail `Dialog` includes `WeakSpotDiagnosisPanel` calling `POST /api/v1/weak-spots/:id/diagnose` with fresh `Idempotency-Key`.
- [x] **Add Japanese two-path capture pass (2026-05-15)** — `/add` shows only Word/Sentence/Deck plus "Add manually" + "Generate card" buttons; all back-of-card capture deferred to `/add/review`. `useCaptureDraftStore.mode` carries `'generate' | 'manual'`.
- [x] **Add Japanese back-of-card-aware pass (2026-05-15)** — optional capture surface reframed around the actual back-of-card fields (Reading / Meaning / Mnemonic / Picture) plus Note / Source. **IA deviation:** Deck is required at capture.
- [x] **Add Japanese session-faithful preview pass (2026-05-15)** — symmetric 6/6 layout; `AddSessionPreview` renders the actual `CardFront` from the in-progress draft via a single `buildPreviewCard` helper.
- [x] **Add Japanese capture canonical-composition pass (2026-05-15)** — `/add` restructured to match Tomo's canonical page rhythm. Extracts shared primitives `PageHeader`, `MobileStickyActionBar`, `ExitLinksRow` used by Today / Review Setup / Settings too.
- [x] **Review Summary redesign (2026-05-15)** — closure-first page composed of `SectionCard`s with a six-pattern state classifier (strong / mixed / difficult / weak spot / ended-early / no-pattern). Session "End session" routes to Summary for symmetric calm close.
- [x] **Today client readability pass (2026-05-15)** — `today-client.tsx` 804 → ~365 lines via extracted pure helpers and shared `lib/japanese-greeting.ts`. No functional change.
- [x] **Canonical documentation cleanup** — product, design, database truth pinned to `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/DATABASE.md`.
- [x] **Auth and account management** — signup, OTP, login, refresh, logout, password change, account deletion.
- [x] **Profile preferences and interests** — profile CRUD, study prefs, JLPT target, daily limits, timezone, interests.
- [x] **Deck and card API** — CRUD, AI + manual creation, semantic similarity, embedding regeneration, idempotency, optimistic concurrency.
- [x] **Premade deck backend** — browse, subscribe, unsubscribe, self-healing. *(Subscribe path superseded by copy model 2026-05-17.)*
- [x] **FSRS review engine** — due queue, submit, batch, forecast, session summary, rollback/forget/reschedule, weak spot flagging.
- [x] **AI generation endpoints** — cards, sentences, mnemonics with prompt sanitization, structured-output validation, response caching.
- [x] **Analytics backend + UI** — heatmap, accuracy, JLPT gap, milestones, review forecast, bundled dashboard. Streaks removed in Stage 8.
- [x] **Core frontend app shell** — auth, onboarding, dashboard, decks, premade browse, review, summary, analytics, settings, profile.
- [x] **Offline review queue** — failed submissions queued locally and replayed through the batch endpoint.
- [x] **API + shared-schema test coverage** — API unit + integration tests, shared auth schema tests.
- [x] **Weak spots list + detail (Stage 1)** — `GET /api/v1/weak-spots` (filters, sorts, tuple cursor) + `GET /:id`; orphans preserved via LEFT/INNER join switching. Commit `81a0b35` (2026-05-14).
- [x] **Weak spots resolve + reopen (Stage 2)** — idempotent flips; partial-unique-index 23505 → HTTP 409 `WEAK_SPOT_ALREADY_OPEN`.
- [x] **Weak spots list spec-alignment patch (Stage 2.5)** — adds `deckOrder` sort + `diagnosis: available | missing` filter.
- [x] **Drill session creation + snapshot (Stage 3)** — `POST /api/v1/weak-spots/drill-sessions` with `Idempotency-Key`; two new tables + SECURITY DEFINER RPC; zero FSRS writes.
- [x] **Drill session resume + stale detection (Stage 4)** — `GET /:sessionId` returns queue + `isCanonicalStateStale` + `staleCards`; shared `compute_card_state_fingerprint_v1` helper with migration-time self-test.
- [x] **Drill attempts + scheduler-invariance suite (Stage 5)** — `POST /:sessionId/attempts`; anti-fraud composite FK; `eventId` as the DB-level idempotency contract; 200-iteration property suite proves no `cards`/`review_logs` writes from the drill path.
- [x] **Drill session lifecycle + source expansion (Stage 6)** — `/finish` + `/abort` (idempotent, terminal one-way); five source values via four-branch `UNION ALL`.
- [x] **Coding-standards fix-up on diagnose (Stage 7.1)** — `withIdempotency` + strict empty-body schema + parallelized fetches + versioned cache key on `/diagnose`.
- [x] **Free MVP completion + AI weak-spot diagnosis (Stage 7)** — paid/free tier model removed; `POST /:id/diagnose` ships free; writes only `weak_spots.diagnosis` + `weak_spots.prescription` (originally `leeches.diagnosis` + `leeches.prescription`; table renamed 2026-05-18).
- [x] **Remove legacy streaks + expose rollback/forget/reschedule (Stage 8)** — migration `20260604000000_remove_legacy_streaks.sql` drops `get_streak` and rebuilds `get_dashboard_data` without it. **BREAKING:** `ApiAnalyticsDashboardSchema.streak` removed end-to-end. Newly exposed: `POST /reviews/:reviewLogId/rollback`, `POST /cards/:id/forget`, `POST /cards/:id/reschedule`.

%% kanban:settings

```
{"kanban-plugin":"board","lane-width":800}
```

%%
