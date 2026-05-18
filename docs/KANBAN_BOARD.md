---

kanban-plugin: board

---

Source for status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), refreshed 2026-05-17.

## To Do

- [ ] **IA wireframe doc cleanup (low-risk)**
  - `docs/information_architecture/00_sitemap.md:65` contains a stray absolute path (
  `/home/sergei/Downloads/tomo_wireframes_by_page/01_today.md`) injected mid-tree — delete.
  - `00_sitemap.md:30` says *"the generated Lapis-compatible note"*. "Lapis" is a foreign product name; replace with "
  Tomo card note".
  - `03_review_session.md:201` references *"the legacy design system's four-channel rating rule"* — current design
  system lives in [DESIGN.md](DESIGN.md); drop the "legacy" framing.
- [ ] **Reconcile IA card types with `card_type` schema**
  - Canonical enum is `comprehension | production | listening` ([
  `packages/shared-types/src/fsrs.types.ts`](../packages/shared-types/src/fsrs.types.ts), [DATABASE.md](DATABASE.md), [TDD.md](TDD.md)).
  IA describes *Vocabulary Recognition* + *Sentence Understanding* + *Production* and omits Listening entirely (
  `03_review_session.md`, `08_generated_card_review.md`, `11_card_detail.md`, `00_sitemap.md:60`).
  - Decide: ship Listening for MVP (add wireframes for audio-front cards) **or** defer Listening explicitly in IA +
  canonical docs. Clarify that "Vocabulary Recognition" and "Sentence Understanding" are `layout_type` variants of
  `comprehension`, not peer `card_type` values.
- [ ] **Resolve "Problem Card" vs "Leech" vocabulary**
  - Backend, kanban, status, and PRODUCT.md all say "leech" (`/api/v1/leeches`, leech-drill, AI leech diagnosis). New IA
  renames the surface to **Problem Card Repair** with `/review/repair` + `/review/repair/[cardId]` (`05_…`, `06_…`).
  - Either bless "Problem Card" as the canonical user-facing label (requires explicit PRODUCT.md edit) or rewrite the IA
  pair to use "Leech". Pick one before the leeches frontend lands.
- [ ] **Confusable items frontend (deferred)**
  - Held back when `/insights/mistakes` was deleted on 2026-05-17. The `ConfusablePairList` component was removed
  alongside the rest of the page; reintroduce as a tab/section inside `/insights/leeches` once the per-pair drill
  workflow (or at least the data pipeline for confusable pairs) is designed. Backend signal isn't shipped yet either, so
  the surface and the data work can be planned together.
- [ ] **Flesh out IA stub pages**
  - **Code-verified 2026-05-17:** Only two `StubPage` instances remain —
  `apps/web/app/(app)/cards/[cardId]/repair/page.tsx` and `apps/web/app/(app)/decks/[id]/preview/page.tsx`. Every other
  Phase-1 stub has been replaced with a real implementation. `grep -rln 'StubPage' apps/web/app/` returns exactly those
  two pages plus the `_components/StubPage.tsx` component definition.
  - Phase 1 of the App Router migration shipped 2026-05-14: `/dashboard`→`/today`, `/analytics`→`/insights`,
  `/decks/browse` removed, `/profile` removed, card detail hoisted to `/cards/[cardId]`, `/review` staging moved under
  `/review/setup`, and stubs scaffolded for `/add`, `/add/review`, `/cards`, `/cards/[cardId]/repair`,
  `/decks/[id]/preview`, `/insights/{mistakes,progress,forecast,statistics}`. Stubs render a page title + outgoing IA
  links only — implementations are the follow-up work. Tracked per surface in [
  `status/FRONTEND.md`](status/FRONTEND.md).
  - **Insights Overview shipped 2026-05-15** per IA `13_insights_overview.md`: `apps/web/app/(app)/insights/page.tsx`
  now renders a teacher-report Overview with date-seeded headline insight, Progress/Mistakes/Planning sections, and
  inline section CTAs. The shared route-based tab nav (`InsightsTabs`) lives in `insights/layout.tsx` and applies across
  all five views. The four sibling tabs (Mistakes, Progress, Forecast, Statistics) replaced their `StubPage`
  placeholders with topic-scoped bodies that dock the existing chart components inside a shared `InsightsSiblingBody`
  chrome.
  - **Insights Forecast / Statistics / Progress redesigned 2026-05-17** per IA `14_/15_/16_insights_*`. Each page now
  owns its own `PageHeader` with vermillion kanji ornament (`次` Forecast, `数` Statistics, `進` Progress),
  `SectionCard` chrome, and bespoke chart vocabulary tuned to its narrative job: Forecast's workload + new-card-impact +
  catch-up planner; Statistics' five anchored sections with sticky scroll-spy tabs; Progress' double-ribbon retention
  chart (±1 SE inside ±1 SD), stacked-area maturity pipeline (vermillion alpha ramp), proportionally-sized JLPT coverage
  strip, and warm-paper year heatmap. Progress legacy widgets (`TodayProgressCard`, `JLPTProgressBars`) removed. Each
  redesigned page carries a dev panel cycling through documented states.
  - **Insights Mistakes redesigned 2026-05-17** per IA `14_insights_mistakes.md`. Field-notes voice page: page kanji
  `誤`, global filter row (Deck + Time range, default 30d, localStorage-persisted), and five SectionCards in IA order:
  Pattern Summary (`紋`, editorial diagnosis + chips), Problem Cards (`困`, stem-and-leaf bars at
  `[2–3] [4–5] [6–7] [8+]` with vermillion on the leech-zone bar; click a bar drills into the underlying card list),
  Leeches (`蛭`, dedicated list with Repair-all CTA and per-row diagnoses), Confusable Items (`紛`, pair list with
  dashed "next backend pass" fallback), Card Quality (`欠`, horizontal bars per issue type linking into
  `/cards?missing=…`). Shared `MistakeRowList` primitive carries the click-row-opens-detail behavior and inline
  `{N} selected` bulk bar (Review / Repair / Suspend). Dev panel covers off / clean / many / leech-heavy / not-enough /
  loading / error. Legacy widgets (`AccuracyBreakdown`, `InsightsSiblingBody`) removed. Production rendering uses an
  empty/limited-data shell until the per-card mistake pipeline ships server-side; the dev preview shows the full design
  end-to-end. **Remaining:** backend pass for per-day maturity-pipeline snapshots (Progress); backend pipelines for
  problem-card list, confusable detection, and quality-issue counts (Mistakes); em-dash sweep across user-facing copy;
  close out the "Leeches frontend wiring" item below — the dashboard leech surface now lives on this page.
- [ ] **Settings IA: missing sections**
  - IA `18_settings.md` proposes top-level Account / Learning / Review behavior / Display / Data and sync / Security.
  Current app ships `/settings`, `/settings/learning`, `/settings/profile`, `/settings/security` only. Display, Data &
  sync, and Review-behavior sections need designs + routes (or explicit deferral notes in IA).
- [ ] **Onboarding deck recommendations (frontend slice)**
  - Reclassified 2026-05-17: no backend endpoint required. Every signal a recommender needs is already exposed —
  `premade_decks.{jlpt_level, domain, deck_type}` ship through `GET /api/v1/premade-decks`, and
  `profiles.{jlpt_target, interests}` are captured by earlier onboarding steps.
  - Replace the hardcoded `RECOMMENDED_DECKS` constant in `apps/web/app/onboarding/decks/page.tsx:32-37` with
  client-side scoring over the catalogue: JLPT proximity to `profile.jlpt_target` (`target == level` +3, adjacent +1)
  plus tag overlap with `profile.interests` (+1 per match). Always include the Kana deck if no kana familiarity is
  signalled. Slice the top N.
  - Copy selections through the new `POST /api/v1/premade-decks/:id/copy` action (Backend Completion Plan Stage 4) —
  this replaces the old `subscribe` action, which is being removed alongside the subscription model.
  - Revisit the boundary only if the catalogue grows to thousands of decks, recommendations need user-history queries,
  or "what was recommended" needs server-side telemetry.
- [ ] **Premade "copy to library" migration — frontend slice (follow-up to Backend Completion Plan Stage 4)**
  - **Backend shipped 2026-05-17 (this PR).** Schema, RPC, service, controller, route, and shared types all migrated to
  the copy model — see Done.
  - **Frontend remaining:** rename the premade-browse "Subscribe" button to **"Add to my library"**; on the deck list,
  render a "From: <premade name>" attribution chip whenever `sourcePremadeId` is set; unify the delete-deck confirmation
  copy (no special "this is a premade fork" wording — the warning is the same for every deck: "Deleting this deck will
  permanently remove your progress on its cards."). The TanStack Query layer was rewired in the backend PR (
  `useCopyPremadeDeck` replaces the prior `useSubscribeToPremadeDeck` / `useUnsubscribeFromPremadeDeck` /
  `useMySubscriptions`); component-level wiring against the new hook is the open work.
  - **Coverage:** frontend tests assert that the "Add to my library" button issues a `POST .../copy` and that two clicks
  produce two distinct deck rows.
- [ ] **Sweep stale subscription language across docs and wireframes**
  - With the copy model landing, the words "subscribe", "subscription", "lastSeenVersion", and "version drift" are
  obsolete in non-historical contexts.
  Sweep [TDD.md](TDD.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [status/BACKEND.md](status/BACKEND.md), [status/FRONTEND.md](status/FRONTEND.md), [status/TESTING.md](status/TESTING.md), [status/AI_AND_JAPANESE.md](status/AI_AND_JAPANESE.md),
  and the [information_architecture/](information_architecture/) wireframes for any references and replace with
  copy-model language. Done-column kanban entries are *historical* and stay accurate as-of their shipped date — do not
  rewrite them, but a clarifying "superseded by 2026-05-17 copy-model decision" suffix on the Stage 4 Done entry is
  appropriate.
- [ ] **Weak spots Phase 3 — drill follow-ups**
  - Phase 1 (List + Detail + Diagnosis) shipped 2026-05-17. Phase 2 (Drill flow) shipped 2026-05-17 — see Done. Routes
  renamed to `/insights/weak-spots/*` on 2026-05-17. **Code-verified 2026-05-17:** dashboard surface is not shipped —
  `grep -n leech apps/web/app/(app)/today/_components/section-primitives.tsx` returns only a single planning comment ("
  chart, active decks, leeches, recent activity, and a practice signal") with no rendering code. No `countAsReview` /
  `convertToReview` matches anywhere in `apps/web/` either.
  - Remaining: dashboard weak-spots card on `/today`, the `hasLeeches` signal (derivable from `useUnresolvedLeechCount`
  already shipped), and the "Count this as a review" override inside the drill session (the backend route exists; the UI
  surface is non-trivial because it requires presenting the four FSRS channels at the moment the learner converts a
  drill answer into a real review).
- [ ] **Dashboard backend contracts**
  - Replace remaining placeholder dashboard surfaces with explicit contracts. (Deck rollup endpoint shipped as Backend
  Completion Plan Stage 3 — `list_decks_paginated` now returns per-deck due / new / review / mature / last-reviewed in
  one round-trip; see Done.)
- [ ] **Sentence-layout AI generator branch (Backend Completion Plan Stage 13)**
  - Stage 12 (schema + DB CHECK) shipped 2026-05-17; Stage 13 wires the AI path. Add a `layout: 'sentence'`
  discriminator (or a separate `generateSentenceCard` function if the prompt diverges enough) in
  `apps/api/src/services/ai.service.ts`. Extend `GeneratedSentenceCardSchema` in
  `packages/shared-types/src/schemas/ai.schema.ts` to match `SentenceFieldsDataSchema`. Bump
  `SENTENCE_CARD_PROMPT_VERSION` to isolate the cache. Wire the create path to dispatch on `layoutType` and call the
  right generator. Manual sentence-card creation form + sentence review render rules are frontend follow-ups.
- [ ] **Launch-size premade catalogue** — content work; expand JLPT + Joyo + grammar coverage beyond starter seeds.
- [ ] **Frontend test coverage** — pick a runner; cover review / onboarding / premade-browse / analytics flows.
- [ ] **Legal pages** — Privacy Policy + ToS.
- [ ] **App-level system pages** — `error.tsx` and `not-found.tsx` exist at both `apps/web/app/` and
  `apps/web/app/(app)/` (verified 2026-05-17 via `find apps/web/app -name 'not-found.tsx' -o -name 'error.tsx'`). Still
  missing: any `loading.tsx` files (zero matches across `apps/web/app`). Add streaming-aware skeletons for the
  highest-latency routes (`/today`, `/review/setup`, `/insights/*`) and remove this item once shipped.
- [ ] **Public brand landing page** — replace the `app/page.tsx` redirect with a designed brand surface. Verified
  2026-05-17: `apps/web/app/page.tsx` is a 7-line file that calls `redirect('/onboarding')`.
- [ ] **Public SEO + installability** — `app/manifest.ts`, maskable icons, JSON-LD, expanded `sitemap.ts`. Verified
  2026-05-17: `apps/web/app/robots.ts` and `apps/web/app/sitemap.ts` exist; `manifest.ts` does not.
- [ ] **Full frontend CSP nonce policy** — extend the current `frame-ancestors`-only CSP once Next nonce handling is
  designed.

## In Progress

- [ ] **Resolve design implementation drift** — fix drift on touch; reserve broad cleanup for a focused pass.
- [ ] **Home / decks / masthead polish** — deck-list styles, My Decks layout, masthead background, analytics nav icon.
- [ ] **Settings V3 + Profile redesign**
  - Kanji-led sticky rail (人 学 帳 鍵), hybrid auto-save / explicit-save, custom `TomoSlider` + `TomoSelect`, inline
  delete-account re-auth.
  - `/profile` ships six dev-toggleable card variants; production default is `stack`.
- [ ] **Remove visible AI wording** — outcome-based copy (create / suggest / draft) replaces `Generate with AI` labels;
  keep AI terms in internal code/docs.
- [ ] **Premade decks onboarding polish** — backend exists; onboarding still uses placeholder recommendations.
- [ ] **Japanese metadata surfaces** — schemas support pitch accent / frequency / collocations / kanji breakdown; fill
  missing UI workflows.

## Review

- [ ] **Verify custom system-page coverage** — confirm broad `error.tsx` / `not-found.tsx` / loading coverage before
  promoting to Done.

## Deferred

- [ ] **Morphological parsing tokens** *(deferred 2026-05-17)* — canonical storage + parser pipeline for tokenized
  Japanese morphology. History: `cards.tokens` + `cards.parsed_at` existed via migration
  `20260502000004_align_card_schema.sql` and were removed in `20260518000000_drift_and_dead_column_cleanup.sql`. Re-add
  only when a concrete UI surface needs the tokens (e.g. sentence-layout breakdown, fine-grained furigana over kanji
  compounds, search by morpheme). Parser-library decision (kuromoji.js / MeCab / SudachiPy) belongs to that follow-up,
  not this MVP.
- [ ] **Future settings expansion ideas**
  - **Lens:** every setting carries a cost (cognitive load, code paths, support questions). Only add when a single
  default cannot serve user variance.
  - **Filter:** candidates must (a) personalize the practice algorithm, (b) personalize AI voice, or (c) honor
  privacy/agency. Fit inside an existing tab before adding a new one.
  - **Profile tab candidates:** public-profile visibility toggle, default deck for new cards, pitch accent + romaji
  display.
  - **Learning tab candidates:** per-modality enablement (highest-value next add), furigana density, learner-controlled
  leech threshold, rating button style.
  - **Security tab candidates:** 2FA (TOTP/magic-link), recent sign-in activity list.
  - **Potential new tabs:** Notifications (daily reminder, weekly recap), AI (tone, explanation length), Data &
  Privacy (export, opt-outs), Account (email change, billing, SSO).
  - **Ranked next picks:** (1) Notifications, (2) per-modality enablement, (3) public-profile visibility, (4) data
  export.
  - **Trap:** a "Display" tab — most options are OS-level (`prefers-color-scheme`, `prefers-reduced-motion`); shipping
  it signals distrust of system settings.

## Done

- [x] **Sentence-layout schema contract + CHECK (Backend Completion Plan Stage 12, 2026-05-17)** — closes the open-shape gap on sentence-layout cards. `SentenceFieldsDataSchema` in `packages/shared-types/src/schemas/field-shapes.schema.ts` was an open record (`z.record(z.string(), z.unknown())`, "reserved for future use"); now a concrete shape: `{ ja: string, en: string, furigana: string, breakdown?: Array<{token, reading?, meaning?}>, audio?: string, nuance?: string }`. New `SentenceBreakdownTokenSchema` for the per-token annotation rows. Migration `supabase/migrations/20260612000000_sentence_layout_check.sql` drops and recreates `cards_fields_data_shape` with a new sentence-layout arm — required keys are `ja`/`en`/`furigana` (matches the Zod side); vocabulary/grammar arm reproduced verbatim; uses `NOT VALID` + `VALIDATE CONSTRAINT` per docs/DATABASE.md so the brief lock window doesn't block writes on unrelated columns. A `DO`-block sanity-check counts any existing sentence-layout rows that would violate the new predicate and raises with remediation guidance if any are found (zero on the live DB per the production seed analysis). Backfill plan documented in the migration even though no real cards needed it. `getSentenceFrontBack` helper in `packages/shared-types/src/field-shapes.ts` updated to read `ja`/`en` (it was reading the legacy `front`/`back` keys that never existed on the open shape). The schema-tightening rippled into two type sites that needed unknown-casts: `apps/api/src/controllers/cards.controller.ts` (the wire-level permissive `fieldsDataSchema` produces `Record<string, unknown>` which the new tight `FieldsData` union no longer admits structurally; the cast acknowledges the gap and points at the DB CHECK as the runtime enforcer) and `apps/web/app/(app)/add/review/_components/generated-review-client.tsx` (the synthetic preview card builder; the cast is safe because the assembly is always layoutType='vocabulary' with word/reading/meaning). `apps/api/src/services/leech.service.ts`'s `DrillSessionCardRowSchema` + `DrillSessionDetailCardRowSchema` were updated to use the shared `FieldsDataSchema` directly so the parse result natively matches the wire shape (no more loose-record-then-cast pattern). Re-exports added in `packages/shared-types/src/index.ts` for `WordFieldsSchema`, `VocabularyFieldsDataSchema`, `GrammarFieldsDataSchema`, `SentenceFieldsDataSchema`, `SentenceBreakdownTokenSchema`, `ExampleSentenceSchema`, `KanjiBreakdownSchema`, `FieldsDataSchema`. Stage 8 + leech-service unit test fixtures that used the legacy `{ sentence, translation }` / `{ front, back }` open shapes updated to the canonical ja/en/furigana shape. Coverage: 9 new unit tests in `packages/shared-types/src/schemas/__tests__/field-shapes.schema.test.ts` (minimum shape, optional breakdown/audio/nuance round-trip, three missing-key rejections, legacy open-shape rejection, breakdown row with token-only, FieldsDataSchema union sentence-arm narrowing); 3 new integration tests in `apps/api/tests/integration/cards.routes.test.ts` (canonical shape round-trips through POST + GET, missing ja rejected at the DB CHECK, vocabulary cards still pass). Migration applied via `bunx supabase db push`. Note: Stage 11 (personal-best persistence) was skipped per user direction; the To-Do entry was removed from this kanban.

- [x] **Confusable-items detection (Backend Completion Plan Stage 10, 2026-05-17)** — `GET /api/v1/insights/confusable-pairs?limit=…` returns the user's top card pairs they've mis-rated in the same session AND that are semantically similar. The detection pipeline reads `review_logs` for `again`/`hard` ratings within shared sessions, generates canonical-ordered pairs (`card_a < card_b`), groups by user/pair to count distinct sessions, and filters by pgvector cosine similarity ≥ 0.70 on `cards.embedding`. Thresholds (MISS_COUNT_THRESHOLD=2, SIMILARITY_THRESHOLD=0.70) live inside the RPC; the plan flagged tuning as risk territory. Migration `supabase/migrations/20260611000000_confusable_pairs.sql` adds the `confusable_pairs` table (PK `(user_id, card_a, card_b)` + `CHECK (card_a < card_b)` that makes detection idempotent at the schema layer; FK CASCADE to profiles/cards; partial index on `(user_id, miss_count DESC, similarity_score DESC)` for the top-N read path; RLS read-own policy), the `record_confusable_pairs()` SECURITY DEFINER detection function (one INSERT statement with CTE pipeline that processes every user in one pass; cards without embeddings excluded), the `get_confusable_pairs(p_user_id, p_limit)` reader RPC (joins both card sides for display fields; caps `p_limit` at 100), and a defensive `cron.schedule('record_confusable_pairs_daily', '0 3 * * *', …)` wrapped in `DO`-block (03:00 UTC offsets from Stage 9's 02:15 UTC). **HNSW note documented in the migration**: the existing `cards_embedding_idx` serves nearest-neighbour queries (`ORDER BY embedding <=> q LIMIT k`); this stage's detection evaluates `ca.embedding <=> cb.embedding` in a `WHERE` predicate over a pre-filtered candidate set, which HNSW doesn't assist — correct behaviour, not missing-index. Wire shape `ApiConfusablePairSchema` carries nested `cardA`/`cardB` display fields. Service `insights.service.ts::listConfusablePairs` + controller `confusablePairs` + GET `/confusable-pairs` route on the existing `/api/v1/insights` mount. `database.types.ts` surgically synced. Coverage: 5 unit + 8 integration tests including idempotency (twice-running detection produces the same row count) and threshold negatives (single-session co-mis-rate, orthogonal embeddings). Migration applied via `bunx supabase db push`; defensive `DO` block logged a NOTICE about pg_cron not being enabled — exactly the design intent.

- [x] **Per-day maturity snapshots (Backend Completion Plan Stage 9, 2026-05-17)** —
  `GET /api/v1/insights/maturity-history?days=90|180|365` returns the user's per-state card counts per day for the
  requested window. Powers the Progress page's stacked-area maturity-pipeline chart. **Option A** (snapshot table +
  cron) over Option B (on-demand reconstruction from review_logs) — the chart is hit on every Progress page load, and
  reconstructing from logs would burn CPU and grow with history length. Migration
  `supabase/migrations/20260610000000_card_state_snapshots.sql` creates: (1)
  `card_state_snapshots(user_id, snapshot_date, new_count, learning_count, review_count, relearning_count, mature_count, recorded_at)`
  table with `(user_id, snapshot_date)` PK + RLS, (2) `record_card_state_snapshots()` SECURITY DEFINER function — one
  INSERT iterating all profiles with FILTER aggregates per FSRS state, `ON CONFLICT DO UPDATE` so re-runs are
  idempotent, (3) `get_maturity_pipeline_history(p_user_id, p_days)` RPC that reads historical rows from the snapshot
  table and computes today live from `cards` so the chart reflects the current moment between cron runs (the
  `snapshot_date < v_today` filter on historical reads is what makes this work), (4) a defensive `DO`-block-wrapped
  `cron.schedule('record_card_state_snapshots_daily', '15 2 * * *', …)` that only fires when `pg_extension` shows
  pg_cron is enabled — the migration applies cleanly on projects where pg_cron is not yet enabled (table + functions
  still land; only the cron schedule is skipped). Per-state boundaries: New = state 0, Learning = state 1, Review =
  state 2 + scheduled_days<21, Relearning = state 3, Mature = state 2 + scheduled_days≥21 (Anki convention; matches
  Stage 3's `list_decks_paginated` predicate). Suspended cards excluded from every bucket. Wire types:
  `ApiMaturitySnapshotSchema` + `ApiMaturityHistoryDaysSchema` (`'90' | '180' | '365'`) in
  `packages/shared-types/src/schemas/api.schema.ts`. Service
  `apps/api/src/services/insights.service.ts::listMaturityHistory` parses the string days enum to int when calling the
  RPC; SQLSTATE 22023 → HTTP 400 `MATURITY_HISTORY_DAYS_INVALID`. Controller + GET route mounted on the existing
  `/api/v1/insights` base. `database.types.ts` surgically synced (table + both RPCs). Coverage: 6 new unit tests (
  projection, days parsing, longest-window passthrough, 22023→400 mapping, generic dbError fallthrough, envelope shape);
  7 new integration tests (today-always-emitted invariant, every-state-counted fixture across
  new/learning/review/relearning/mature/suspended boundary, manual cron-simulation upsert round-trip, unknown days 400,
  missing days 400, 401 unauth, cross-user isolation). Migration applied via `bunx supabase db push` — pg_cron not
  enabled on the target Supabase project, so the defensive `DO` block logged a NOTICE pointing to the dashboard for the
  operator to enable; everything else works (the RPC always computes today live, so the application never sees a gap
  even without the cron). **Consumer note:** the Progress page is the natural consumer; the frontend
  `ProgressMaturityPipeline` component currently relies on a dev fixture per the Insights Progress redesign on
  2026-05-17 — wiring it to the new endpoint is a follow-up frontend slice.

- [x] **Card-quality issue counts (Backend Completion Plan Stage 8, 2026-05-17)** — `GET /api/v1/insights/card-quality`
  returns six rows of `{ issueType, count }` over the user's vocabulary+grammar cards: `missing_reading`,
  `missing_meaning`, `missing_example`, `missing_mnemonic`, `missing_picture`, `missing_nuance`. Migration
  `supabase/migrations/20260609000000_get_card_quality_issues_rpc.sql` adds SECURITY DEFINER RPC
  `get_card_quality_issues(p_user_id uuid)` with a single-scan strategy: one `COUNT(*) FILTER (…)` aggregate per issue
  type computed in one HashAggregate pass over the user's vocabulary+grammar slice, then `LATERAL VALUES` unpivots into
  six output rows. The six rows are emitted unconditionally — even when every count is zero — so consumers iterate a
  stable shape. Defensive `jsonb_typeof(... ) = 'array'` guard on `exampleSentences` keeps the RPC robust against schema
  drift. Sentence-layout cards excluded (their `fields_data` shape is intentionally open and doesn't carry these keys).
  Premade source rows excluded by the `user_id` filter. Service
  `apps/api/src/services/insights.service.ts::listCardQualityIssues` projects the RPC envelope to camelCase; controller
  `apps/api/src/controllers/insights.controller.ts::cardQuality` handles the route. Wire types
  `ApiCardQualityIssueSchema` + `ApiCardQualityIssueTypeSchema` in `packages/shared-types/src/schemas/api.schema.ts`.
  `database.types.ts` surgically synced with the new RPC entry. **Stage 1 dependency satisfied** — `picture` and
  `nuance` field admittance shipped in Stage 1, so the counts can be non-zero once Stage 2's AI generator (and future
  authoring) starts populating them; today they'll typically be high (all existing cards predate the Lapis fields) and
  trend down as new content lands. **Consumer note:** the existing frontend `cards-quality-bars.tsx` defines a
  different (kebab-case) enum —
  `missing-audio | missing-sentence | missing-kanji-breakdown | missing-mnemonic | missing-nuance`. The mismatch is a
  known follow-up; the backend ships the plan's six types as-is per the surgical-scope rule. Coverage: 5 new unit
  tests (projection, parameter passthrough, generic dbError 5xx fallthrough, ZodError on RPC drift, envelope-shape
  invariant); 6 new integration tests (zero state on a fully-populated card, three-issue card counted on the right bars,
  empty-`exampleSentences`-array boundary case, sentence-layout exclusion, cross-user isolation, 401 unauth). Migration
  applied via `bunx supabase db push` before the test sweep.

- [x] **Problem-card list (lapse-bucketed) (Backend Completion Plan Stage 7, 2026-05-17)** —
  `GET /api/v1/insights/problem-cards?bucket=…` returns the user's cards in one of four lapse buckets (
  `'2-3' | '4-5' | '6-7' | '8plus'`). Migration `supabase/migrations/20260608000000_get_problem_cards_rpc.sql` adds the
  SECURITY DEFINER RPC `get_problem_cards(p_user_id uuid, p_bucket text)` returning card_id / deck_id / layout_type /
  card_type / jlpt_level / fields_data / state / lapses / reps / due / last_review, filtered to the user's non-suspended
  cards, ordered by `last_review DESC NULLS LAST, id DESC`. Unknown bucket raises SQLSTATE 22023 (defence-in-depth — the
  Zod controller layer rejects unknown values first). New `apps/api/src/services/insights.service.ts` parses the RPC
  envelope and projects to camelCase `ApiProblemCard`. New `apps/api/src/schemas/insights.schema.ts` enforces
  `.strict()` bucket validation. New `apps/api/src/controllers/insights.controller.ts` +
  `apps/api/src/routes/insights.ts` mounted at `/api/v1/insights` in `app.ts`, behind
  `authMiddleware + defaultUserRateLimitMiddleware`. Shared types: `ApiProblemCardSchema`, `ApiProblemCardBucketSchema`,
  and inferred `ApiProblemCard` in `packages/shared-types/src/schemas/api.schema.ts`. **Acceptance:** the `8plus` bucket
  cardinality equals the unresolved-leech count for the same user (integration test pins it) — `process_review` inserts
  a leech at `lapses >= LEECH_THRESHOLD` (default 8) and the partial unique index `leeches_card_user_unresolved_idx`
  prevents duplicates, so the two sets are guaranteed equal. **Consumer note:** the `/insights/mistakes` page that
  originally consumed this endpoint was retired in the 2026-05-17 IA restructure; the endpoint ships consumer-agnostic
  so future surfaces (a `/cards` lapse-range saved view, a Stage 9 analytics histogram) can pick it up without a
  contract change. Coverage: 5 new unit tests (RPC projection, bucket passthrough, 400 mapping on unknown bucket, 5xx
  fallthrough on generic RPC error, empty-list return); 6 new integration tests (bucket-bounded filtering,
  8plus-vs-leeches parity, suspended-card exclusion, unknown-bucket 400, missing-bucket 400, 401 unauth, cross-user
  isolation).

- [x] **Tomo daily note API (Backend Completion Plan Stage 6, 2026-05-17)** — `GET /api/v1/tomo/note` returns one
  learner-scoped, learner-day-scoped note. The wire envelope is
  `{ body: string, kind: 'insight' | 'idiom', dateKey: string }`. **AI path:** new `generateTomoNote` in
  `apps/api/src/services/ai.service.ts` with `TOMO_NOTE_PROMPT_VERSION = 'v1'` baked into a Redis cache key (
  `tomo:note:v1:{userId}:{dateKey}`), 36h TTL. Prompt consumes the learner profile (JLPT target, native language,
  interests) plus yesterday's review summary (count + retention from `get_heatmap_data`) and asks for a single short
  prose body — voice rules in the prompt prevent perky / motivational-poster tone. Structured output validated via
  `GeneratedTomoNoteSchema`. **Idiom fallback:** new `apps/api/src/data/idioms.json` carries 3–4 curated idioms per JLPT
  level (N5..N1 + `beyond_jlpt`); the service substitutes one whenever the AI path fails (open chat breaker, missing
  OpenAI key, malformed model response, generic generator error) — the route never returns a 5xx for
  content-availability reasons. Idiom selection is deterministic by SHA-256 hash of `(userId, dateKey)` so a learner
  gets the same idiom for the same day across retries; different days rotate naturally. **Service:** new
  `apps/api/src/services/tomo-note.service.ts` resolves the learner's timezone via `normalizeTimeZone`, computes
  `dateKey` via `Intl.DateTimeFormat('en-CA', { dateStyle: short })`, parallelizes the interests + heatmap fetches,
  calls the generator, and catches all failure modes for the idiom path. **Controller + route:** new
  `apps/api/src/controllers/tomo.controller.ts` + `apps/api/src/routes/tomo.ts` mounted at `/api/v1/tomo` in `app.ts`.
  Auth + `defaultUserRateLimitMiddleware` + `aiRateLimitMiddleware` (per-minute) + `aiDailyQuotaMiddleware` (per-day) —
  same chain as `/api/v1/ai`. **Shared types:** `GeneratedTomoNoteSchema` in `ai.schema.ts` and `ApiTomoNoteSchema` +
  `ApiTomoNoteKindSchema` in `api.schema.ts`. **Frontend:** new `apps/web/lib/actions/tomo.actions.ts` +
  `apps/web/lib/api/tomo.ts` (`useTomoNote` hook); `apps/web/lib/api/queryKeys.ts` gains `tomo.note()`;
  `apps/web/lib/api/config.ts` adds `staleTimes.tomoNote = 1h`. `liveTomoNote: TomoNote | null = null` in
  `review-staging-client.tsx:236` is now sourced from the query result (mapping `dateKey` → frontend `TomoNote.date`). *
  *Coverage:** unit tests for the two pure helpers (`todayDateKey` timezone behaviour, `yesterdayDateKey`
  month/year/leap-year math, `pickIdiomBody` determinism + rotation + null-jlpt fallback to N3); cache-key test in
  `ai.service.test.ts` proving pre-version key shape is bypassed; integration test in
  `apps/api/tests/integration/tomo.routes.test.ts` covers the wire shape, the same-day cache-stability invariant (two
  consecutive GETs return byte-identical bodies), and the 401-unauthenticated path. No DB migration (per the plan).

- [x] **Premade "copy to library" migration (Backend Completion Plan Stage 4 — rewritten 2026-05-17, copy model)** —
  replaces the subscribe-with-sync model with copy-as-starting-point. The previously-shipped Stage 4 (version surfacing)
  and the planned Stage 5 (sync RPC) are obsolete and have been struck from the plan; their wire fields and table are
  now removed by this migration. **Migration `supabase/migrations/20260607000000_premade_copy_model.sql`:** drops
  `public.user_premade_subscriptions` (cascades index + RLS policy), drops
  `public.subscribe_to_premade_deck(uuid, uuid)` and `public.unsubscribe_from_premade_deck(uuid, uuid)`, drops
  `public.premade_decks.version` + its `premade_decks_version_positive` CHECK, drops `public.decks.is_premade_fork`, and
  creates `public.copy_premade_deck(p_user_id uuid, p_premade_deck_id uuid)` returning `(deck_id uuid, card_count int)`.
  The new RPC is SECURITY DEFINER with `SET search_path = ''` and an explicit `GRANT EXECUTE TO service_role`; validates
  source `is_active = TRUE` and raises `premade_deck_not_found` (SQLSTATE 02000 → HTTP 404) otherwise; allows duplicates
  by design (no uniqueness check on `(user_id, source_premade_id)`). Bulk-clones every source card into the new deck
  with fresh FSRS state (`state=0`, `due=NOW()`, `reps=0`, `lapses=0`, `scheduled_days=0`, `learning_steps=0`,
  `stability=0`, `difficulty=0`, `last_review=NULL`) and carries `embedding` + `embedding_updated_at` from each source
  row so similarity search works day 1 without a backfill. **Route:** `POST /api/v1/premade-decks/:id/subscribe` renamed
  to `POST /api/v1/premade-decks/:id/copy` (idempotent via `withIdempotency`; empty body validated via
  `emptyBodySchema`; reuses the existing `subscribeRateLimitMiddleware` for per-user lockout — same blast radius).
  `GET /api/v1/premade-decks/subscriptions/me` and `DELETE /api/v1/premade-decks/:id/subscribe` are removed. **Service:
  ** `premade.service.ts` loses `subscribeToPremadeDeck`, `unsubscribeFromPremadeDeck`, `listSubscriptions`,
  `listSubscriptionsRaw`, and the `SubscribeRpcRowSchema` / `SubscriptionDbRowSchema` / `ForkedDeckRowSchema` envelopes;
  gains `copyPremadeDeck(userId, premadeDeckId)` with a `CopyRpcRowSchema` envelope. **deck.service.ts simplified:**
  `deleteDeck` no longer special-cases premade forks — every deck deletes via the same FK-cascade path; `DECK_COLUMNS`,
  `DeckListRpcRowSchema`, `DeckOwnerRowSchema`, and `toRow` all drop `is_premade_fork`. **Shared types:**
  `ApiPremadeSubscriptionSchema` and `ApiSubscribeResultSchema` removed;
  `ApiCopyPremadeDeckResultSchema = { deckId, cardCount }` added; `isPremadeFork` removed from `ApiDeckSchema`;
  `version` removed from `ApiPremadeDeckSchema`. **Frontend lib:** `subscribeToPremadeDeckAction` /
  `unsubscribeFromPremadeDeckAction` / `listMySubscriptionsAction` replaced by `copyPremadeDeckAction`;
  `useSubscribeToPremadeDeck` / `useUnsubscribeFromPremadeDeck` / `useMySubscriptions` replaced by `useCopyPremadeDeck`;
  `queryKeys.premadeDecks.subscriptions` dropped; one stale `invalidateQueries` call in `deck-detail-view.tsx` removed.
  **Coverage:** unit test suite rewritten for the copy RPC (success, 404 on inactive source, 500 on empty RPC return,
  duplicate copies produce distinct decks, generic dbError on infra failure); integration suite
  `apps/api/tests/integration/premade.routes.test.ts` rewritten to cover the four plan acceptance criteria (fresh copy →
  201 + Location, duplicate copy → two independent decks, copy → delete → copy-again → third independent deck, inactive
  deck → 404 PREMADE_DECK_NOT_FOUND); `decks.routes.test.ts` `API_DECK_KEYS` contract updated to drop `isPremadeFork`.
  `database.types.ts` surgically synced (the user should run `bun --filter @fsrs-japanese/api gen:types` against the
  migrated DB to reconcile in full). Frontend visual rebranding ("Subscribe" → "Add to my library", attribution chip,
  unified delete-confirmation copy) tracked as a separate To Do.

- [x] **Surface premade `version` + `lastSeenVersion` on subscriptions (Backend Completion Plan Stage 4, 2026-05-17)**
  *— superseded by the 2026-05-17 copy-model rewrite. The schema fields and the route this entry shipped have been
  removed by `supabase/migrations/20260607000000_premade_copy_model.sql`. This entry remains as historical record of
  what shipped before the model change.* — *superseded 2026-05-17 by the copy-model decision; the next Backend
  Completion Plan Stage 4 will remove `version`, `lastSeenVersion`, and the `user_premade_subscriptions` table entirely.
  This entry remains as historical record of what shipped.* — read-only contract change.
  `GET /api/v1/premade-decks/subscriptions/me` now returns each subscription with `version` (the current
  `premade_decks.version`) and `lastSeenVersion` (the subscriber's stored
  `user_premade_subscriptions.last_seen_version`). The pair lets the frontend render a "new content available" badge
  whenever `version > lastSeenVersion` without any write path landing yet — the matching `sync` route is Backend
  Completion Plan Stage 5. No migration needed: both columns already exist on the initial-schema tables (
  `premade_decks.version INT NOT NULL DEFAULT 1` at `supabase/migrations/20260425000000_initial_schema.sql`;
  `user_premade_subscriptions.last_seen_version INT NOT NULL DEFAULT 1` in the same migration). Wire-shape impact:
  `ApiPremadeSubscriptionSchema` in `packages/shared-types/src/schemas/api.schema.ts` gains both fields as required
  `z.number()`. Service impact: `listSubscriptionsRaw` in `apps/api/src/services/premade.service.ts` now SELECTs
  `last_seen_version` from the subscriptions table and `version` from the joined `premade_decks` slice, surfacing both
  through the mapping; the internal `PremadeNameRowSchema` was extended to carry `version` alongside the display name,
  and the local `Map<string, string>` keyed by deck id became a `Map<string, { name, version }>`. Coverage: new
  `apps/api/tests/integration/premade.routes.test.ts` creates a test-scoped premade deck (isolated from the seed
  catalogue to avoid mutating shared state), subscribes, asserts `version === lastSeenVersion = 1` on the wire, then
  bumps the source deck's version to 2 directly and re-GETs to assert `version > lastSeenVersion` — proves both fields
  round-trip and the "new content available" gate works end-to-end.

- [x] **Dashboard deck rollup batch (Backend Completion Plan Stage 3, 2026-05-17)** — `GET /api/v1/decks` now returns
  per-deck rollups in one round-trip, eliminating the N+1 fanout that fired one `getDeck` call per visible deck on
  `/today` and `/decks`. Migration `supabase/migrations/20260606000000_list_decks_paginated_rollups.sql` drops +
  recreates the `list_decks_paginated` RPC with six new columns (`due_count`, `new_count`, `mature_count`,
  `due_new_count`, `due_review_count`, `last_reviewed_at`), computed via a CTE-based single-pass aggregate: page the
  user's decks (cursor pagination unchanged), then one `GROUP BY c.deck_id` over `cards` filtered to the page's deck IDs
  with `COUNT(*) FILTER (...)` expressions for the buckets and `MAX(c.last_review)` for the timestamp.
  `last_reviewed_at` reads from `cards.last_review` (kept fresh by `process_review`) instead of joining `review_logs` —
  avoids the cross-table crossing and stays inside the indexable `(deck_id, user_id)` slice. Wire shape:
  `ApiDeckWithStatsSchema` gains `lastReviewedAt: string | null`; `listDecks` now returns `ApiList<ApiDeckWithStats>` (
  was `ApiList<ApiDeck>`); `getDeck` adds one parallel `MAX(last_review)` query to match. `DeckListRpcRowSchema` keeps
  the rollup columns `.optional()` so the same schema parses both RPC rows (always with rollups) and direct
  `.from('decks').select(...)` reads (no rollups) — used by `createDeck` and `updateDeck` which intentionally return
  slim `ApiDeck` without rollups. Coverage: integration test `apps/api/tests/integration/decks.routes.test.ts` updates
  the `API_DECK_KEYS` contract on the list endpoint, asserts the empty-deck path produces zeros + null, and adds a new
  test that creates two cards and confirms the populated rollups land on `/decks` in a single request. Frontend N+1
  elimination (deck-list.tsx's `useQueries` fanout) tracked as a follow-up — the wire change is the deliverable; FE
  adoption is opt-in.

- [x] **AI generator population for Lapis-style fields (Backend Completion Plan Stage 2, 2026-05-17)** — extends
  `GeneratedCardDataSchema` in `packages/shared-types/src/schemas/ai.schema.ts` with the same five Lapis keys admitted
  in Stage 1 (`pitchPosition: integer ≥ 0`, `nuance`, `picture`, `expressionAudio` on the card root; `sentenceAudio` on
  each `exampleSentences[]` entry). Also extends `GeneratedSentencesSchema` to admit `sentenceAudio` for symmetry. The
  `generateCard` prompt in `apps/api/src/services/ai.service.ts` now asks the model for `pitchPosition` (with an
  explicit mora-position rule: "0 = heiban / flat, 1 = drop after the first mora, etc.") and `nuance` ("1–2 sentences on
  register, connotation, or distinctions vs. close synonyms"), and explicitly tells the model NOT to invent URLs for
  `picture`, `expressionAudio`, or `sentenceAudio` — those require hosted assets the system can't yet produce.
  Introduces `CARD_PROMPT_VERSION = 'v2'` baked into the Redis cache key (mirroring `DIAGNOSIS_PROMPT_VERSION` at
  `ai.service.ts:62`); cache entries written under the pre-Stage-2 unversioned key shape are bypassed forever by the new
  key and TTL out naturally — zero-downtime cache invalidation. Coverage: six new unit tests in
  `apps/api/src/services/__tests__/ai.service.test.ts` (cached payload round-trips `pitchPosition` + `nuance`; old
  `card:…` cache shape is no longer read; `GeneratedCardDataSchema` admits `sentenceAudio` on example sentences; rejects
  negative and non-integer `pitchPosition`; admits `picture` / `expressionAudio` for forward compatibility); existing
  cache-key tests updated to the `card:v2:…` shape. Stage 3 (Dashboard deck rollup batch) is the next backend track; the
  launch-size catalogue work (Stage 14+) will benefit most from this once it ships.

- [x] **Card content fields for Lapis-style review UI — schema admission (Backend Completion Plan Stage 1, 2026-05-17)
  ** — additive, all-optional fields added to `WordFieldsSchema` and `ExampleSentenceSchema` in
  `packages/shared-types/src/schemas/field-shapes.schema.ts`: `picture?: string` (URL), `expressionAudio?: string` (
  URL), `pitchPosition?: number` (non-negative integer; coexists with the free-form `pitchAccent` string),
  `nuance?: string`, and `sentenceAudio?: string` on the nested example sentence. All `.nullable().optional()` so both
  omitted and explicit-null wire shapes parse cleanly; `pitchPosition` is constrained to integer ≥ 0 at the wire so a
  bad value cannot silently land in `fields_data`. No migration needed — the `cards_fields_data_shape` CHECK
  constraint (migration `20260504000007_normalization_cleanup.sql`) only enforces *required* keys for
  vocabulary/grammar (`word`, `reading`, `meaning`) without whitelisting additional keys, so the new fields pass through
  without a schema change. Coverage: new unit test file
  `packages/shared-types/src/schemas/__tests__/field-shapes.schema.test.ts` (11 cases — round-trip with all five fields
  populated, null tolerance, omitted-shape tolerance, negative-int and non-integer rejection on `pitchPosition`,
  composition through `VocabularyFieldsDataSchema`/`GrammarFieldsDataSchema`/`FieldsDataSchema`); integration round-trip
  test added in `apps/api/tests/integration/cards.routes.test.ts` that creates a vocabulary card with all five Lapis
  fields, fetches it, lists it, and asserts the values survive on every projection. Stage 2 (AI generator population +
  `CARD_PROMPT_VERSION` bump) tracked separately in To Do.

- [x] **Design-system migration — `lucide-react` retired (verified 2026-05-17)** —
  `grep -rln 'lucide' apps/web/{app,components,lib}` returns a single hit, and it's a *comment* in
  `apps/web/components/icons/arrow-glyph.tsx:5` documenting the rule ("never lucide"). No imports, no usages. Custom
  icon set under `apps/web/components/icons/` covers every nav/UI affordance. Outstanding hygiene: remove the
  `lucide-react` line from `apps/web/package.json` (if still present) and run `bun install` to drop it from the
  lockfile — strictly a dependency-cleanup chore, not a UI task.

- [x] **Rename Leeches → Weak spots in user-facing surfaces (2026-05-17)** — the IA was using both "Leeches" and "Weak
  spots" inconsistently on the same page. Settled on "Weak spots" as the friendlier learner-language term (the doc
  itself says *"Tomo should not require Anki vocabulary"*). Route renamed `/insights/leeches/*` →
  `/insights/weak-spots/*` (via `git mv` so history is preserved); all 25 URL references in `nav-config.ts`,
  `weekly-report.ts`, `today-client.tsx`, the saved-view pill on `/cards`, and inside the route itself bulk-rewritten.
  User-facing labels follow: STUDY sidebar entry, page metadata titles, Dialog eyebrows, the "Back to Leeches" footer
  links, the cards table's Leech badge, and the `?savedView=leeches` pill label all read "Weak spots" now. Kanji
  ornament shifts 蛭 (leech) → 弱 (weak) on the page header, dialog eyebrow, drill setup header, drill session top bar,
  and drill summary header — matches the new label while staying within the existing chrome-marks vermillion stroke
  register. **Internal code stays aligned with the backend**: components (`LeechesView`, `LeechListItem`,
  `LeechDetailsDialog`), hooks (`useLeechesQuery`, `useUnresolvedLeechCount`), the store (`useLeechDrillSessionStore`),
  the actions, the query-key family, and file names all keep "leech*" so the FE↔BE mapping to `/api/v1/leeches` is
  unambiguous.

- [x] **Retire /insights/mistakes (2026-05-17)** — the Mistakes page is deleted. After the IA restructure (Mistakes
  moved into STUDY alongside Reviews and Leeches), its five sections were doing three different jobs across the wrong
  register. Final distribution: **Pattern summary** and **Problem cards bars** are removed entirely — the editorial
  pattern read was duplicating Overview's weekly note, and Problem cards were redundant with the Leeches saved-view pill
  already in `/cards` plus the dedicated `/insights/leeches` page. **Card quality bars** moved to `/cards` as
  `cards-quality-bars.tsx`, mounted behind a `欠 Card quality` toggle button between the controls cluster and the
  result-count row — collapsed by default so the table-first browser stays calm; clicking a bar still filters `/cards`
  by `?missing=…`. **Confusable items** are deferred — the visualization isn't on `/cards` because a "pair filter"
  affordance doesn't fit the saved-view chrome cleanly; the component is preserved in git history and can be
  reintroduced later (likely as a tab inside `/insights/leeches` once a Confusables drill exists). **Leeches mini-list**
  simply deleted (already canonicalized at `/insights/leeches`). The STUDY nav section drops from three items to two (
  Reviews + Leeches). Four cross-link sites repointed to `/insights/leeches`: Today's exit-link row, three deeplinks in
  `weekly-report.ts`, the leeches-view footer (link removed). NavIconKey union shrinks; IconMistakes stays defined in
  chrome-marks but no longer in the nav registry.

- [x] **Leeches Phase 2 — Drill flow (2026-05-17)** — complete drill experience under `/insights/leeches/drill/*`. Three
  routes: `/setup` configures source (unresolved / deck-scoped / high-lapse / current card via `?cardId=`) + session
  size (5 / 10 / 20) + repeat policy and POSTs `/api/v1/leeches/drill-sessions` to create; `/[sessionId]` runs the
  focused practice loop with a bespoke 3-channel `DrillRatingBar` (Missed / Hesitated / Remembered, NOT FSRS
  Again/Hard/Good/Easy per the doc's voice rules), persistent "Practice only · Review schedule unchanged" status strip,
  Space/Enter reveal, 1/2/3 keyboard rating, and an "End drill" abort path; `/[sessionId]/summary` renders
  drill-specific metrics (cards practiced, first-pass remembered, hesitated, missed, median response time, queue
  completion). New `useLeechDrillSessionStore` (Zustand, discriminated phase: idle / active / finished) holds queue,
  attempts, reveal state, and idempotent `eventId` per attempt. Five new server actions (`createDrillSessionAction`,
  `getDrillSessionAction`, `recordDrillAttemptAction`, `finishDrillSessionAction`, `abortDrillSessionAction`) + five
  TanStack Query hooks; cache key family `queryKeys.leeches.drillSession(id)` scoped under `leeches.all()` so
  resolve/reopen invalidations sweep drill caches too. The drill layout is a fixed-overlay zen pattern mirroring
  `/review/session/layout.tsx` — no sidebar during a drill. Scheduler-invariance contract honored: the drill UI never
  calls `submitReview`; attempts insert only into the drill namespace. "Count this as a review" override is
  intentionally deferred to Phase 3 (backend exists; surface complexity makes it a separate slice). Entry points from
  Phase 1 surfaces (`LeechListItem`'s Drill button + `LeechDetailsDialog`'s Drill button) now route to
  `/insights/leeches/drill/setup?cardId=…`; the unresolved Leeches view also gained a "Drill these →" QuietLink in the
  footer. Built 5.53 / 3.82 / 3.21 kB across the three routes; typecheck + lint + build all clean.

- [x] **Leeches sidebar entry + unresolved-count badge (2026-05-17)** — closes the discoverability gap from Phase 1.
  `apps/web/app/(app)/_components/nav-config.ts` now lists `/insights/leeches` as the third Insights child (after
  Mistakes, before Progress) with a new `hasLeechCount: true` flag. A new `useUnresolvedLeechCount()` projection over
  `useLeechesQuery` returns `{ count, hasMore, isLoading }`, capped at 50 with a `+` overflow display. `NavItem` accepts
  an optional `leechBadge` prop and a dedicated `LeechCountNavItem` wrapper subscribes only when a child has
  `hasLeechCount`, so other nav rows pay zero subscription cost. The chip renders as a JetBrains-Mono `text-[0.625rem]`
  count in a paper-raised pill with a vermillion-deep stroke; it disappears when count is 0, in the collapsed 64px rail,
  and on query error. The row's accessible name becomes `"Leeches, N unresolved"` when the badge is present.
  MobileDrawer inherits the entry automatically. Spec: [
  `specs/leeches_discoverability.spec.md`](../specs/leeches_discoverability.spec.md). Verified via typecheck + lint +
  build.

- [x] **Leeches Phase 1 — List + Detail + Diagnosis (2026-05-17)** — first delivery against
  `docs/Add Leeches List and Drill Support.md`. New dedicated route at `/insights/leeches` reaches the
  unresolved/resolved leech list with a kanji `蛭 · Leeches` page header, six filter dimensions (Status pills + Deck /
  JLPT / Modality / Diagnosis selects + Sort), and a row anatomy that surfaces Japanese hero (`FuriganaText`), meaning,
  deck, modality, JLPT pill, lapses (mono tabular), last-review and detection dates, diagnosis status, and per-row
  Drill / View details / Mark resolved (or Reopen) actions. Clicking a row opens a `Dialog` (xl tier) detail surface
  with the card hero, an FSRS state grid (lapses / reps / last review / due / deck / modality / flagged / status), and a
  `LeechDiagnosisPanel` that calls `POST /api/v1/leeches/:id/diagnose` with a fresh `Idempotency-Key` per click and
  renders the returned diagnosis + prescription in the vermillion-wash AI register from `regenerate-panel.tsx`. Six
  TanStack Query hooks (`useLeechesQuery`, `useLeechDetailQuery`, `useResolveLeechMutation`, `useReopenLeechMutation`,
  `useDiagnoseLeechMutation`) and a parallel `lib/actions/leeches.actions.ts` ship as the API layer; cache keys include
  the full filter object per the doc's "query keys must include every filter dimension" rule, and mutations invalidate
  only `queryKeys.leeches.all()`. Empty state mirrors `MistakesEmpty` (calm copy, no celebration); dev panel cycles
  eight fixtures (off / clean / few / many / resolved / orphan / loading / error). LocalStorage-backed filter
  persistence keyed `'leeches:filters'`. The Mistakes page's inline `LeechesList` "Repair all" link now points to
  `/insights/leeches`. Built 12.1 kB / 165 kB First Load; typecheck + lint + build all clean. **Remaining (Phase 2):**
  `LeechDrillSetup` → `LeechDrillSession` → `LeechDrillSummary` against the already-shipped drill-session endpoints.

- [x] **Add Japanese two-path capture pass (2026-05-15)** — fifth pass on
  `docs/information_architecture/06_add_japanese.md`. Removes the v4 optional-fields surface (the `補 · ADD MORE`
  SectionCard, its `Tabs` strip, and the `AddOptionalCard` component) from /add and defers all back-of-card capture (
  Reading, Meaning, Mnemonic, Picture, Note, Source) to the downstream Generated Card Review page (/add/review). /add
  now presents only the three required fields (Word or phrase, Example sentence, Deck) and two action buttons.
    - Action area replaces the single "Create card" button with a **Secondary "Add manually"** + **Primary "Generate
      card"** pair. Both buttons stay enabled at all times; clicking either runs a single `validate()` over
      Word/Sentence/Deck and either surfaces per-field inline errors (via the existing `Input` / `Textarea` `error`
      props + a dedicated paragraph beneath the Deck dropdown) or persists the draft and routes to `/add/review`.
    - `useCaptureDraftStore` gains a `mode: 'generate' | 'manual'` field on `CaptureDraft` so the downstream page knows
      whether to run AI generation or open a blank manual-edit form.
    - The "⌘ ⏎ to create" mono hint and the matching keyboard shortcut are removed; the previous two-click
      empty-sentence warning gate is gone (errors fire on first click now).
    - **Deck dropdown swapped to `TomoSelect`** to match the Settings dropdown register (combobox + portalled listbox +
      2px corners + 3px vermillion-wash focus halo). A small custom `DeckField` wrapper provides the label, hint, error,
      and the zero-decks "Create a deck" fallback so the visual register stays consistent with the other primary fields.
    - `AddSessionPreview` is simplified: Front/Back toggle and the `reading` / `meaning` / `pictureDataUrl` props are
      removed (no back-of-card capture on this page anymore); preview consumes only `word` + `sentence`. Synthetic-card
      builder kept; just smaller.
    - Verified via typecheck + lint + build. `/add` ships at 6.4 kB (166 kB First Load; -3 kB from dropping the CardBack
      chunk + optional surface); `/today` and `/review/setup` unchanged.
- [x] **Add Japanese back-of-card-aware pass (2026-05-15)** — fourth pass on
  `docs/information_architecture/06_add_japanese.md`. Reframes the optional capture surface around the *actual*
  back-of-card fields rendered by `apps/web/components/review/session/CardBack.tsx` (Reading / Meaning / Mnemonic /
  Picture) plus two personal fields (Note / Source). The v3 inline chip row + AddChipRow component are removed;
  `add-chip-row.tsx` is deleted. The optional fields now live in a sibling SectionCard below the required form (kanji
  `補` / `ADD MORE`, description "Lock in what you already know. Tomo fills the rest.") with a `Tabs` strip mirroring
  `SetupControls`: tabs **Back of card** (badge = Reading/Meaning/Mnemonic/Picture filled count) and **Your notes** (
  badge = Note/Source filled count). New `AddOptionalCard` (`apps/web/app/(app)/add/_components/add-optional-card.tsx`)
  owns the Tabs + panels + image-picker block.
    - Primary-field labels rewritten for clarity: "Word" → **Word or phrase**, "Where you found it" → **Example sentence
      **. Sentence hint expanded to: *"A sentence where the word appears. Helps Tomo pick the right meaning."*
    - **Deck is now required at capture (explicit IA deviation).** Submit is gated on `wordPresent && deckPresent`. Deck
      moves into the required-fields card as the third primary field; "No deck yet — Tomo will suggest one" placeholder
      is replaced with "Choose a deck…", and a `Pick a deck to save into.` hint appears once Word is filled but Deck
      isn't. Zero-decks state disables the Select and renders an inline QuietLink to `/decks`. The IA's "Do not make
      deck selection required before capture." note should be revisited next time
      `docs/information_architecture/06_add_japanese.md` is touched.
    - **`AddSessionPreview` extended with a Front / Back toggle** (mono uppercase, two-button rail in the SectionCard's
      `rightContent` slot). The `buildPreviewCard` helper now accepts `reading`, `meaning`, and `pictureDataUrl` so the
      Back face faithfully shows the user-filled fields (the real `CardBack` component is consumed directly;
      `WordStack`, `SentenceBand`, and the Picture render automatically from the synthetic card). Toggle only appears
      once the user has typed a Word; empty state still renders the date-seeded teacher quote.
    - **`ExitLinksRow` removed from /add** per direction; Today still uses it.
    - `useCaptureDraftStore` gains `reading`, `meaning`, `mnemonic` string fields; existing fields unchanged. `cardType`
      remains `'auto'` for now (card-type chip dropped from /add this pass).
    - Verified via typecheck + lint + build. `/add` ships at 9.04 kB (171 kB First Load; +5 kB from pulling in the
      back-face component graph); `/today` and `/review/setup` unchanged.
- [x] **Add Japanese session-faithful preview pass (2026-05-15)** — third pass on
  `docs/information_architecture/06_add_japanese.md`. Swaps the 5/7 asymmetric split for a **6/6 symmetric** layout with
  the form on the left (`lg:col-span-6`) and a sticky preview column on the right (
  `lg:col-span-6 lg:sticky lg:top-10 lg:self-start`). The v2 silhouette preview is replaced by `AddSessionPreview` (
  `apps/web/app/(app)/add/_components/add-session-preview.tsx`), which constructs a minimal synthetic `ApiDueCard` from
  the in-progress draft (via a single `buildPreviewCard` helper that is the only point /add knows about the session
  card's data shape) and renders the actual `CardFront` from `apps/web/components/review/session/CardFront.tsx`. The
  preview SectionCard uses `omitTitle` + `stripeTone="brand"` matching the session chrome exactly; the FrequencyBadge /
  OverflowMenu chrome row is deliberately omitted (no rank or audio at capture time). Empty state renders only a
  date-seeded teacher-voice quote inside the card chrome (no fake headword). Target-not-found state surfaces a quiet
  mono footnote below the SectionCard (not inside it); when that footnote shows, the form-level empty-sentence warning
  is suppressed so feedback never doubles. The primary `Create card` action moves out of the preview SectionCard into a
  sibling action block immediately below it (sticky aside still owns the desktop action; mobile uses the existing
  `MobileStickyActionBar`). `⌘ ⏎ to create` mono hint moves from the form into the right-column action block.
  `add-preview-card.tsx` (the v2 silhouette / stat-strip component) is removed. Verified via typecheck + lint + build;
  /add ships at 9.25 kB (166 kB First Load); /today and /review/setup route sizes unchanged.
- [x] **Add Japanese capture canonical-composition pass (2026-05-15)** — second pass on
  `docs/information_architecture/06_add_japanese.md`. Restructures `/add` to match Tomo's canonical page rhythm (page
  header outside any SectionCard, multi-module 5/7 row, mobile sticky action bar, exit-links outro), aligning the
  surface with Today / Review Setup / Settings instead of the prior 760px single-card form. Extracts three shared
  primitives that those neighbor pages also consume:
    - `apps/web/components/ui/PageHeader.tsx` — kanji eyebrow + display h1 + sub-line; `setup-client.tsx` swapped to
      consume it (zero visual change).
    - `apps/web/app/(app)/_components/mobile-sticky-action-bar.tsx` — fixed-bottom, `lg:hidden`, warm-paper /
      soft-hairline / backdrop-blur; `setup-client.tsx`'s inlined version replaced.
    - `apps/web/app/(app)/_components/exit-links-row.tsx` — mobile-stacked / desktop-inline QuietLink row;
      `today-client.tsx`'s inlined version replaced.
    - Adds `add-preview-card.tsx`: a sticky-on-`lg+` SectionCard (kanji `見` / CARD PREVIEW) with three states (empty
      silhouette + date-seeded teacher quote / word-only with reading reserved as `—` / word + sentence with
      target-substring highlighted in vermillion via `aria-live="polite"`). Renders a footnote when the target isn't
      found in the sentence; suppresses the form's empty-sentence warning in that state so feedback isn't doubled.
      Includes a 2-up StatPair strip ("Today" / "This week", `—` until a user-scoped card listing exists per the brief's
      fallback).
    - Form moves into a SectionCard (kanji `記` / WRITE IT DOWN). Primary `Create card` action moves into the preview
      aside on `lg+` and into `MobileStickyActionBar` on `<lg`; a `sr-only` submit button preserves native `Enter`
      semantics inside the form. Page wrapper now uses the canonical
      `mx-auto max-w-[1440px] px-6 md:px-12 lg:px-16 pt-8 md:pt-10 lg:pt-12 grid-cols-1 content-center gap-y-8` shell.
    - `useCaptureDraftStore` already carries note / deck / source / card-type; image stays preview-only (no request
      body) per prior decision.
    - Verified via typecheck + lint + build. `/add` ships at 8.84 kB (165 kB First Load); `/today` and `/review/setup`
      route sizes unchanged after the primitive swaps.
- [x] **Review Summary redesign (2026-05-15)** — implements `docs/information_architecture/04_review_summary.md`.
  Closure-first page composed entirely of `SectionCard`s: full-width closure card (kanji `終` / `中` via `kicker` field
  on `SummaryContent`; display-register headline; mono receipt; pattern-aware rationale; primary `Button` plus optional
  editorial secondary; responsive kitsune `Logo` at 96/144 anchored right on `lg+`), 2-col middle row with Session
  details SectionCard (hairline-separated "What to notice" diagnosis + `RatingDistributionBar`) paired with Problem
  cards SectionCard (kanji `困`, when leeches present) or a promoted `WeekRhythmStrip` (when not), and a full-width
  `WeekRhythmStrip` row below when problem cards take the middle row's right cell. Outer/inner mirrors Setup's
  `flex flex-1 + content-center` so short-content states sit balanced in the viewport. State classifier (
  `lib/review/summary-pattern.ts`) maps `SessionSummary` + an `ended=early` query signal onto six patterns (strong /
  mixed / difficult / leech / ended-early / no-pattern); state changes content, not layout. `WeekRhythmStrip` wired via
  `useReviewForecast` + browser-timezone-resolved `todayKey` from `buildDashboardCalendarContext`. Bespoke
  `SummaryHero` + 3-day `TomorrowGlance` components retired; their roles absorbed into SectionCard chrome and the richer
  7-day strip respectively. Session page's "End session" routes to the Summary (was `/today`) so early exits get the
  same calm close. Session dev toolbar carries a "Summary states" section and the page renders an in-page
  `SummaryDevSwitcher` in non-production builds. Verified via typecheck + lint.
- [x] **Today client readability pass (2026-05-15)** — `today-client.tsx` shrunk from 804 → ~365 lines by extracting
  pure helpers into `today-due-queue.ts` (queue math) and `today-preview-data.ts` (dev-only mocks). Greeting helpers
  moved to shared `lib/japanese-greeting.ts` (deduplicates the same logic from the login page). Banner-comment
  readability passes applied to `today-hero.tsx`, `section-primitives.tsx`, and `week-rhythm-strip.tsx`. No functional
  or visual changes. Verified via typecheck + lint + build.
- [x] **Canonical documentation cleanup** — product, design, database truth pinned to `docs/PRODUCT.md`,
  `docs/DESIGN.md`, `docs/DATABASE.md`.
- [x] **Auth and account management** — signup, OTP, login, refresh, logout, password change, account deletion.
- [x] **Profile preferences and interests** — profile CRUD, study preferences, JLPT target, daily limits, timezone,
  interests.
- [x] **Deck and card API** — CRUD, AI + manual creation, semantic similarity, embedding regeneration, idempotency,
  optimistic concurrency.
- [x] **Premade deck backend** — browse, subscribe, unsubscribe, self-healing.
- [x] **FSRS review engine** — due queue, submit, batch, forecast, session summary, rollback/forget/reschedule, leech
  flagging.
- [x] **AI generation endpoints** — cards, sentences, mnemonics with prompt sanitization, structured-output validation,
  response caching.
- [x] **Analytics backend + UI** — heatmap, accuracy, JLPT gap, milestones, review forecast, bundled dashboard. Streaks
  removed in Stage 8.
- [x] **Core frontend app shell** — auth, onboarding, dashboard, decks, premade browse, review, summary, analytics,
  settings, profile.
- [x] **Offline review queue** — failed submissions queued locally and replayed through the batch endpoint.
- [x] **API + shared-schema test coverage** — API unit + integration tests, shared auth schema tests.
- [x] **Leeches list + detail (Stage 1)** — `GET /api/v1/leeches` (filters, sorts, tuple cursor) and `GET /:id`; orphan
  leeches preserved via LEFT/INNER join switching. Commit `81a0b35` (2026-05-14).
- [x] **Leeches resolve + reopen (Stage 2)** — idempotent flips; partial-unique-index 23505 → HTTP 409
  `LEECH_ALREADY_OPEN`.
- [x] **Leeches list spec-alignment patch (Stage 2.5)** — added `deckOrder` sort + `diagnosis: available | missing`
  filter.
- [x] **Drill session creation + snapshot (Stage 3)** — `POST /api/v1/leeches/drill-sessions` with `Idempotency-Key`;
  two new tables + SECURITY DEFINER RPC; zero FSRS writes.
- [x] **Drill session resume + stale detection (Stage 4)** — `GET /:sessionId` returns the queue +
  `isCanonicalStateStale` + `staleCards`; shared `compute_card_state_fingerprint_v1` helper with migration-time
  self-test.
- [x] **Drill attempts + scheduler-invariance suite (Stage 5)** — `POST /:sessionId/attempts`; anti-fraud composite FK;
  `eventId` as the DB-level idempotency contract; 200-iteration property suite proves no `cards`/`review_logs` writes
  from the drill path.
- [x] **Drill session lifecycle + source expansion (Stage 6)** — `/finish` + `/abort` (idempotent, terminal one-way);
  five source values wired via four-branch `UNION ALL`; backend feature-complete.
- [x] **Coding-standards fix-up on diagnose (Stage 7.1)** — `withIdempotency` + strict empty-body schema + parallelized
  fetches + versioned cache key on `/diagnose`.
- [x] **Free MVP completion + AI leech diagnosis (Stage 7)** — paid/free tier model removed; `POST /:id/diagnose` ships
  free; diagnose service writes only `leeches.diagnosis` + `leeches.prescription`.
- [x] **Remove legacy streaks + expose rollback/forget/reschedule (Stage 8)**
  - Migration `20260604000000_remove_legacy_streaks.sql` drops `get_streak(uuid)` and rebuilds `get_dashboard_data`
  without streak.
  - **BREAKING:** `ApiAnalyticsDashboardSchema.streak` removed end-to-end (backend + shared-types + frontend
  `StreakCard`).
  - Newly exposed `POST /reviews/:reviewLogId/rollback`, `POST /cards/:id/forget` (optional `{ resetCount }`),
  `POST /cards/:id/reschedule` — all `withIdempotency`-wrapped, `.strict()` schemas, reusing existing service errors.

%% kanban:settings

```
{"kanban-plugin":"board","lane-width":800}
```

%%
