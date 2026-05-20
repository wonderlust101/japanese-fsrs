---
title: Add Leeches List and Drill Support
version: mvp
status: evergreen
tags:
  - tomo
  - feature
  - mvp
  - leeches
  - review
  - fsrs
  - drills
---

# Add Leeches List and Drill Support

Related docs: [[PRODUCT]], [[DESIGN]], [[PRD]], [[DATABASE]], [[CODING_STANDARDS]], [[CODING_STANDARDS_BACKEND]], [[CODING_STANDARDS_FRONTEND]], [[TESTING]]

> [!abstract]
> Surface unresolved leeches in a dedicated learner workflow and let users drill weak cards without polluting FSRS scheduling state. The list and drill mechanics are core SRS support and should be available to free users. Paid users may additionally receive diagnosis and prescriptive guidance, because [[PRODUCT]] defines leech diagnosis as a paid AI feature.

> [!success]
> Implementation status: complete (2026-05-19). List/detail, resolve/reopen, drill session creation, session resume, stale detection, drill attempt recording, scheduler-invariance coverage, AI leech diagnosis, and the Phase 3 follow-ups (`hasWeakSpotCount` chip parity across desktop sidebar + mobile drawer, "Count this as a real review" override inside the drill session, and the closed-by-default "About this read" disclosure on the diagnosis panel) are all shipped. The product was renamed end-to-end from "leeches" to "weak spots" on 2026-05-18; both names refer to the same feature.

## Description

Tomo already has the database foundation for leech detection. The `leeches` table records cards that cross the lapse threshold inside `process_review()` or `process_review_batch()`, and [[DATABASE]] is explicit that leech checks should not be duplicated elsewhere. This feature turns that backend detection into a learner-facing remediation loop:

1. The learner can see unresolved leeches.
2. The learner can open the card context and understand what is failing.
3. The learner can drill leeches in a focused practice mode.
4. The learner can mark a leech resolved when the weak point has been addressed.
5. Paid learners can request or view diagnosis and prescription text.

The product framing matters. Leeches are not "failures" and the UI should not shame the learner. In Japanese SRS, a leech often means the card is ambiguous, the mnemonic is weak, the kanji reading is being confused, or the sentence is too context-thin. The screen should feel like Tomo has a teacher's eye for weak spots, not like it is scolding the user.

### Product Rules

- Basic leech visibility is free.
- Basic leech drilling is free.
- AI diagnosis and prescription are paid.
- Drill practice should not silently rewrite FSRS schedule state unless the product explicitly labels it as a real review.
- Drill-only attempts never insert `review_logs` rows and never update canonical scheduler fields on `cards`.
- If a learner explicitly chooses to count a drill answer as a real review, that action must call the normal review submission path at that moment. A prior drill event is never retroactively reclassified as a review.
- The copy should say "Needs attention" or "Hard to keep" rather than "failed cards."
- Japanese content remains the hero: word, reading, sentence, and furigana must be visually clearer than metadata.

### Non-Goals

- No second leech detection implementation outside the existing review RPC path.
- No automatic suspension of leeches in MVP unless already implemented elsewhere.
- No AI chat UI.
- No gamified punishment loop.
- No color-only severity signals.
- No rewriting the FSRS algorithm or reviewing source premade cards.
- No special `review_logs` kind for drill answers in MVP.
- No temporary review-log writes that are later deleted.
- No drill reminder dates stored in `cards.due`.

## Frontend

### Navigation and Information Architecture

The feature can live under Insights or Practice. Recommended MVP placement:

- Add "Leeches" as an Insights sub-route if the current navigation supports sub-nav.
- Or add a "Weak spots" panel on Analytics that links to the dedicated leeches page.

The screen should serve repeated use. It is not a marketing page and should not have a hero. Use dense but calm product layout:

- Page heading: "Weak spots" or "Leeches" depending on current product vocabulary.
- Short supporting line: "Cards that keep coming back for another look."
- Filter row.
- List of unresolved leeches.
- Drill entry point.

If "leech" appears in the UI, pair it with plain learner language. Advanced Anki users know the term, but Tomo should not require Anki vocabulary to understand the screen.

### Leeches List

Each list row/card should show:

- Japanese word or sentence in `lang="ja"`.
- Reading via `<FuriganaText>` where available.
- Meaning.
- Deck name.
- Card type/modality: comprehension, production, listening.
- JLPT level badge.
- Lapse count.
- Date first detected.
- Last review date if available.
- Diagnosis/prescription status.
- Actions: Drill, View details, Mark resolved.

Use the deck-card/list-row anatomy from [[DESIGN]]:

- Warm Paper Raised surface.
- 1px Soft Hairline border.
- 2px Inari Vermillion top stripe only if using card primitive.
- No resting shadow.
- Deck-type and JLPT badges use documented colors.
- Counts such as `8 lapses` may use JetBrains Mono.

Severity should not be encoded by red alone. If showing severity tiers, use text and ordering:

- "New weak spot"
- "Repeated miss"
- "High attention"

Do not make the whole page alarming red. Inari Vermillion is precious and should stay under the product-surface budget.

### Filters and Sorting

MVP filters:

- Status: unresolved, resolved.
- Deck.
- JLPT level.
- Card type/modality.
- Diagnosis: available, missing, not included in plan.

MVP sort options:

- Most recent detection.
- Most lapses.
- Oldest unresolved.
- Deck order.

Use menus or segmented controls where appropriate. Keep filters query-param backed if the app already supports shareable/filterable routes.

### Drill Mode

The drill mode should feel related to the Review Card but be clearly labeled as focused practice. It should not impersonate the daily review queue unless it actually submits FSRS ratings.

Recommended MVP drill behavior:

- Build a fixed session queue from unresolved leeches or high-lapse candidates.
- Snapshot canonical scheduler state for each queued card when the session starts.
- Present one card at a time using the Review Card visual language.
- Show answer with Space/Enter.
- Keep a persistent, quiet status line such as "Practice only" and "Review schedule unchanged."
- Ask for a drill result using calm labels such as "Missed", "Hesitated", "Remembered" instead of FSRS `Again`/`Hard`/`Good`/`Easy`, because these actions do not submit a real review.
- Record drill attempts in a dedicated drill namespace, not in `review_logs`.
- Do not mutate `cards.state`, `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, or `last_review`.
- Offer a secondary action such as "Count this as a review" only when the learner explicitly wants the answer to affect the real schedule. That action must call the canonical review path and create a fresh real review at action time.
- Offer "Mark resolved" after the learner has remembered the card in drill or after they edit the card/mnemonic.
- Support finishing the session. Pause/resume is optional for the smallest MVP, but the persistence model should not prevent it.

The distinction is important. FSRS scheduling state is the live review system and [[DATABASE]] says it must be written only through `fsrs.service.ts` and review RPCs. A supplementary drill should not distort scheduling by creating hidden early reviews.

If the team decides that drill should use real FSRS reviews, the UI must say that plainly and use the standard four-channel rating buttons. Do not create a lookalike rating row that writes different semantics.

### Drill Session Setup

The session setup screen should stay compact. It is not a power-user simulator by default.

MVP options:

- Source: unresolved leeches, deck-scoped leeches, or high-lapse candidates.
- Limit: bounded card cap such as 5, 10, or 20.
- Order: most lapses, most recent detection, or deck order.
- Repeat policy: missed cards return later in the same session after a small lag.

Advanced options that can be deferred:

- Timed sessions.
- Random order.
- Drill reminders.
- Shadow FSRS simulation.
- Saved drill presets.

The setup copy should make the promise concrete without sounding technical:

- Good: "These cards are for practice. Your review schedule stays as it is."
- Good: "Remembered cards can be marked resolved when they feel steady."
- Avoid: "FSRS metrics will not be contaminated."
- Avoid: "Preview-mode drill subsystem."

### Drill Summary

The summary should report drill-specific progress, not SRS progress:

- Cards practiced.
- First-pass remembered count.
- Cards remembered after another look.
- Missed cards that still need attention.
- Median response time if already collected elsewhere.
- Cards marked resolved.
- Cards explicitly counted as real reviews.

Use labels such as "practice confidence," "session accuracy," or "steady enough to resolve." Reserve "retention" and "retrievability" for canonical FSRS analytics.

### Details Drawer or Page

The details view should include:

- Card front/back content.
- Current FSRS state, due date, reps, lapses.
- Recent review history.
- Current mnemonic/example sentence if present.
- Diagnosis and prescription panel for paid users.
- Upgrade fallback for free users that does not block drill.
- Edit card action if the current app supports card editing.
- Resolve action.

For paid diagnosis transparency, an opt-in "how this was made" affordance is acceptable. It should be closed by default and visually quiet.

### Empty States

Unresolved empty state:

- "No weak spots right now."
- "Keep your daily reviews steady; this list fills only when a card needs extra attention."

Resolved empty state:

- "No resolved weak spots yet."

Avoid:

- "Perfect!"
- "You crushed it!"
- Confetti-style copy.

### Frontend Implementation Standards

Use the existing App Router, TanStack Query, Zustand, and shared-type conventions from [[TDD]] and [[CODING_STANDARDS_FRONTEND]].

Suggested component and hook names:

- `LeechesPage`
- `LeechList`
- `LeechListFilters`
- `LeechListItem`
- `LeechDetailsPanel`
- `LeechDrillSetup`
- `LeechDrillSession`
- `LeechDrillSummary`
- `LeechDiagnosisPanel`
- `useLeechesQuery`
- `useLeechDetailQuery`
- `useCreateLeechDrillSessionMutation`
- `useRecordLeechDrillAttemptMutation`
- `useResolveLeechMutation`
- `useReopenLeechMutation`

Frontend state rules:

- Server-derived leech lists, details, drill session envelopes, and drill summaries live in TanStack Query.
- Drill-card reveal state, current drill index, local keyboard focus, and optimistic session-local attempt state may live in Zustand or component state.
- Represent request state as discriminated unions instead of independent `isLoading`, `error`, and `data` booleans when the state crosses component boundaries.
- Query keys must include every filter dimension: `status`, `deckId`, `jlptLevel`, `cardType`, `diagnosis`, `sort`, and cursor/page state.
- Drill-only mutations invalidate only the affected leech list/detail/session query keys, not all review or analytics data.
- The drill route should lazy-load any heavy details/diagnosis panels so the basic list and drill entry remain quick.
- Local error boundaries should isolate the leeches page or drill surface from the rest of the app shell.
- Japanese card content must use `lang="ja"` and the shared furigana component; avoid duplicating Japanese rendering logic in this feature.
- Keep wire payloads camelCase and import request/response types from `packages/shared-types`; do not redefine backend DTOs in the web app.

## Backend

### API Endpoints

Add or verify these authenticated endpoints:

```http
GET /api/v1/leeches?status=unresolved&deckId=&jlptLevel=&cardType=&limit=&cursor=
POST /api/v1/leeches/drill-sessions
GET /api/v1/leeches/drill-sessions/:id
POST /api/v1/leeches/drill-sessions/:id/attempts
GET /api/v1/leeches/:id
POST /api/v1/leeches/:id/resolve
POST /api/v1/leeches/:id/reopen
POST /api/v1/leeches/:id/diagnose
```

The diagnosis endpoint is paid-gated. The list, detail, resolve, reopen, and drill endpoints are free-tier core SRS support.

If implementation already has a flat `POST /api/v1/leeches/drill-attempts` route, it may remain as a compatibility alias, but the preferred resource model is nested under a session because attempts are meaningful only inside a drill session.

Route ordering matters in Express: mount `/api/v1/leeches/drill-sessions...` before `/api/v1/leeches/:id` so `drill-sessions` is not captured as a leech ID.

### Backend Implementation Standards

Use the existing Express route -> controller -> service boundary:

- Routes apply auth, rate limits, and route ordering.
- Controllers validate `params`, `query`, `body`, and idempotency headers, then call services.
- Services own database queries, transactions, authorization-scoped `WHERE` clauses, and mapping between HTTP camelCase and SQL snake_case.
- Shared request/response schemas live in `packages/shared-types` and should derive TypeScript types with `z.infer`.

Suggested code names:

- Route file: `leeches.routes.ts`
- Controller: `leeches.controller.ts`
- List/detail service: `leeches.service.ts`
- Drill service: `leech-drill.service.ts`
- Diagnosis service or job handler: reuse the existing AI service boundary if one exists; otherwise add a focused service such as `leech-diagnosis.service.ts`.

Suggested shared schemas and types:

- `leechStatusSchema`
- `leechListQuerySchema`
- `leechListItemSchema`
- `leechDetailSchema`
- `createLeechDrillSessionRequestSchema`
- `leechDrillSessionSchema`
- `recordLeechDrillAttemptRequestSchema`
- `leechDrillAttemptSchema`
- `resolveLeechResponseSchema`
- `leechDiagnosisResponseSchema`

Naming conventions:

- HTTP payloads and TypeScript properties use camelCase: `deckId`, `jlptLevel`, `cardType`, `repeatPolicy`, `eventId`, `sessionCardId`, `responseTimeMs`.
- Database columns, SQL aliases before mapping, and SQL enum-like values use snake_case: `deck_id`, `jlpt_level`, `card_type`, `repeat_policy`, `event_id`, `session_card_id`, `response_time_ms`.
- Wire enum values should be camelCase where they are part of public API contracts, for example `unresolvedLeeches`, `highLapseCandidates`, `deckScoped`, `manualSelection`, and `currentCard`.
- Service-layer mappers translate wire enum values to database values such as `unresolved_leeches` and `high_lapse_candidates`.

Security and data-access rules:

- All endpoints are authenticated.
- Every user-owned query includes the authenticated user in the SQL `WHERE` clause.
- Do not accept `userId`, ownership fields, audit fields, entitlement flags, or scheduler state from the client.
- Do not use `SELECT *` for leech list/detail responses.
- Use allow-listed filter and sort keys only.
- Bound `limit` and cursor decode/validation at the route boundary.
- Session creation and attempt recording should run in transactions because they write multiple drill tables.
- Drill attempts require a body-level `eventId` as the domain event identifier and should also honor the project `Idempotency-Key` header convention for retryable mutations. The simplest implementation is to require `Idempotency-Key` to match `eventId` or derive the idempotency replay key from `(user_id, event_id)`.
- Resolve and reopen should be idempotent or return documented conflicts; duplicate retries must not corrupt leech history.
- Diagnosis generation must fail closed when `ai.leechDiagnosis` entitlement is missing.
- Any implemented schema change needs a forward Supabase migration and a matching [[DATABASE]] update in the same change.

### List Query

The list endpoint should join `leeches` to `cards` and `decks` for display context. Do not return `SELECT *`. Select only:

- Leech ID.
- Card ID.
- Deck ID and deck name.
- `fields_data` needed for display.
- `layout_type`.
- `card_type`.
- `jlpt_level`.
- `lapses`.
- `reps`.
- `due`.
- `last_review`.
- `diagnosis` and `prescription` if policy allows.
- `resolved`, `resolved_at`, `created_at`.

Filter by authenticated `user_id` in the WHERE clause. Do not fetch then check ownership in TypeScript.

Cursor pagination should be stable. Suggested sort for unresolved:

```sql
ORDER BY l.created_at DESC, l.id DESC
```

Cursor should include both `created_at` and `id`, following the tuple-cursor pattern documented in [[DATABASE]].

### Resolve and Reopen

Resolve:

- Authenticated user only.
- `WHERE leeches.id = :id AND leeches.user_id = :userId`.
- Set `resolved = TRUE`, `resolved_at = NOW()`.
- Return updated leech summary.

Reopen:

- Useful if a learner resolves too early.
- Set `resolved = FALSE`, `resolved_at = NULL`.
- Be careful with the partial unique index `leeches_card_user_unresolved_idx`. If another unresolved leech exists for the same card/user, return a conflict rather than violating the unique index.

Do not delete leech rows for normal user actions. The table is useful historical learning data, and [[DATABASE]] preserves leech rows even after card deletion by setting `card_id = NULL`.

### Drill Session Service

The drill-session endpoint should build a fixed queue from unresolved leeches or candidate weak cards and persist enough information to prove that drill-only work is isolated from canonical SRS state.

Input:

```json
{
  "source": "unresolvedLeeches",
  "deckId": "optional uuid",
  "jlptLevel": "optional N3",
  "limit": 20,
  "order": "mostLapses",
  "repeatPolicy": "missedAfterLag"
}
```

Output:

```json
{
  "sessionId": "client-or-server-uuid",
  "status": "active",
  "cards": [
    {
      "sessionCardId": "uuid",
      "leechId": "uuid",
      "cardId": "uuid",
      "ordinal": 0,
      "layoutType": "vocabulary",
      "cardType": "comprehension",
      "fieldsData": {},
      "lapses": 8
    }
  ]
}
```

The service should:

- Filter out orphaned leeches where `card_id IS NULL` from drill queues.
- Filter out suspended cards unless product decides suspended leeches are drillable.
- Cap queue size.
- Avoid N+1 queries.
- Keep the queue deterministic for a given request unless a random mode is explicitly added later.
- Insert one `leech_drill_sessions` row.
- Insert one `leech_drill_session_cards` snapshot row per queued card.
- Snapshot canonical scheduler fields before the drill begins: `state`, `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, and `last_review`.
- Record a canonical state fingerprint for stale-session detection.
- Never update `cards`, `review_logs`, or `leeches` while creating the session, except if product chooses to materialize drill enrollment in `leech_drill_card_states`.

### Drill Session Resume

The session detail endpoint should reconstruct the remaining queue from `leech_drill_session_cards` plus immutable attempt events.

If canonical card state changed after the session snapshot, the response should include a stale-session flag:

```json
{
  "sessionId": "uuid",
  "status": "active",
  "isCanonicalStateStale": true,
  "staleCards": ["uuid"],
  "cards": []
}
```

Staleness does not make drill-only continuation unsafe, because drill attempts do not mutate canonical scheduling. It does mean any "what would happen" preview or shadow simulation must be disabled or rebased.

### Drill Attempt Recording

Drill attempts are not `review_logs`. They are not FSRS reviews. They should use a separate service and table so analytics can later answer "did drills help?" without corrupting scheduler history.

Suggested request:

```json
{
  "eventId": "client-generated-uuid",
  "sessionCardId": "uuid",
  "leechId": "uuid",
  "cardId": "uuid",
  "result": "remembered",
  "responseTimeMs": 4200,
  "shownAt": "2026-05-14T14:12:00.000Z",
  "answeredAt": "2026-05-14T14:12:04.200Z",
  "localSequence": 12
}
```

Validate all fields. The route `sessionId` and body `sessionCardId` must resolve to one queued session-card row owned by the authenticated user.

Attempt handling must:

- Treat `eventId` as the immutable domain event identifier and idempotency key for the attempt.
- Accept duplicate retries with the same `eventId` without creating another event.
- Verify the `sessionCardId` belongs to the requested session and authenticated user.
- Derive the canonical `card_id` and `leech_id` for the attempt from `leech_drill_session_cards`; if the client also sends `cardId` or `leechId`, treat them as consistency assertions and reject mismatches.
- Insert one immutable `leech_drill_attempts` row.
- Optionally update `leech_drill_card_states` for drill-only aggregates.
- Return the next queue state or enough information for the client to derive it.
- Never insert into `review_logs`.
- Never update canonical scheduler fields on `cards`.
- Never mark the leech resolved automatically just because a card was remembered once.

### Explicit Real-Review Override

If the learner chooses to count a drill answer as a real review, the API should not mutate the prior drill attempt. Instead:

1. Keep the drill attempt in the drill namespace.
2. Submit a new real review through the existing canonical review route/service.
3. Let `process_review()` / `process_review_batch()` own the card state update, `review_logs` insert, and leech detection behavior.
4. Record the link from the drill attempt to the real review only if a safe identifier is available from the canonical review response.

This keeps review history ordered by the time the learner deliberately chose to affect the schedule. It avoids retroactive review events and protects true retention, future-due forecasts, and FSRS evaluation inputs.

### Scheduler Invariance Contract

For drill-only requests, these canonical SRS outputs must be unchanged before and after the request:

- `cards.state`
- `cards.due`
- `cards.stability`
- `cards.difficulty`
- `cards.elapsed_days`
- `cards.scheduled_days`
- `cards.learning_steps`
- `cards.reps`
- `cards.lapses`
- `cards.last_review`
- `review_logs` row count and contents
- due-card queue results, except for normal wall-clock passage
- review forecast results, except for normal wall-clock passage
- analytics that read canonical `review_logs`, such as heatmap, streak, accuracy, and milestone forecasts

The service should make this hard to violate:

- Drill services do not import or call `fsrs.service.ts` review-submission helpers except from the explicit real-review override path.
- Drill attempts are append-only and idempotent by `eventId`.
- Drill reminder fields, if implemented, live only in `leech_drill_card_states.next_drill_at`; they never write to `cards.due`.
- Drill analytics are labeled and stored separately from retention, retrievability, and review forecast analytics.

### Paid Diagnosis

The diagnosis endpoint should:

- Require `ai.leechDiagnosis` entitlement.
- Load card content, recent review logs, lapse pattern, and any similar-card context needed.
- Send only necessary learner/card context to the model provider.
- Validate structured model output.
- Store `diagnosis` and `prescription` on the existing `leeches` row.
- Return the updated leech detail.

Diagnosis should be generated asynchronously if latency is likely to exceed normal API budgets. If asynchronous:

- Endpoint enqueues a job and returns `status: queued`.
- UI polls or subscribes to completion through existing patterns.
- Job is idempotent per unresolved leech.

Do not label the panel "AI diagnosis" in chrome. The content can have a quiet "how this was made" disclosure if required.

## Database

### Existing Tables Used

The core table already exists:

- `leeches`: unresolved/resolved leech records, diagnosis/prescription, session ID, and creation timestamp.
- `cards`: card context, FSRS state, lapse count, suspension.
- `decks`: deck name and type.
- `review_logs`: recent review history and session context.

Important existing constraints:

- `leeches_card_user_unresolved_idx` prevents duplicate unresolved leeches for the same card/user.
- `leeches_user_id_unresolved_idx` supports "list user's open leeches."
- `leeches.card_id` may be `NULL` after card deletion.

The list endpoint can ship without schema changes if it only displays and resolves leeches.

### New Table: `leech_drill_sessions`

Create a session envelope for one focused drill run:

```sql
CREATE TABLE public.leech_drill_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('unresolved_leeches', 'high_lapse_candidates', 'deck_scoped', 'manual_selection', 'current_card')),
  source_query jsonb NOT NULL DEFAULT '{}'::jsonb,
  mode text NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'timed')),
  repeat_policy text NOT NULL DEFAULT 'missed_after_lag' CHECK (repeat_policy IN ('none', 'missed_after_lag')),
  stop_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'aborted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leech_drill_sessions_source_query_object CHECK (jsonb_typeof(source_query) = 'object'),
  CONSTRAINT leech_drill_sessions_stop_rule_object CHECK (jsonb_typeof(stop_rule) = 'object'),
  CONSTRAINT leech_drill_sessions_finished_at_valid CHECK (finished_at IS NULL OR finished_at >= started_at)
);
```

Indexes:

```sql
CREATE INDEX leech_drill_sessions_user_created_idx
  ON public.leech_drill_sessions (user_id, created_at DESC, id DESC);

CREATE INDEX leech_drill_sessions_user_active_idx
  ON public.leech_drill_sessions (user_id, updated_at DESC, id DESC)
  WHERE status = 'active';
```

RLS:

- `SELECT`: `auth.uid() = user_id`.
- `INSERT`: `auth.uid() = user_id` as defense in depth; API writes via service role.
- `UPDATE`: `auth.uid() = user_id` for status transitions only through API allow-listed fields.
- No delete policy for normal users.

### New Table: `leech_drill_session_cards`

Snapshot the canonical scheduler state for each card when a drill session starts:

```sql
CREATE TABLE public.leech_drill_session_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.leech_drill_sessions(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  leech_id uuid REFERENCES public.leeches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ordinal int NOT NULL CHECK (ordinal >= 0),
  source_reason text NOT NULL CHECK (source_reason IN ('unresolved_leech', 'high_lapse_candidate', 'manual_selection', 'current_card')),
  baseline_state int NOT NULL CHECK (baseline_state BETWEEN 0 AND 3),
  baseline_due timestamptz NOT NULL,
  baseline_stability float NOT NULL CHECK (baseline_stability >= 0),
  baseline_difficulty float NOT NULL CHECK (baseline_difficulty >= 0),
  baseline_elapsed_days int NOT NULL CHECK (baseline_elapsed_days >= 0),
  baseline_scheduled_days int NOT NULL CHECK (baseline_scheduled_days >= 0),
  baseline_learning_steps int NOT NULL CHECK (baseline_learning_steps >= 0),
  baseline_reps int NOT NULL CHECK (baseline_reps >= 0),
  baseline_lapses int NOT NULL CHECK (baseline_lapses >= 0),
  baseline_last_review timestamptz,
  canonical_state_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, ordinal),
  UNIQUE (id, session_id)
);
```

Notes:

- `card_id` is nullable because a card can be deleted after the session starts. Session history should remain inspectable.
- The duplicate `user_id` is intentional. It keeps user-scoped queries and RLS simple without joining through the session table for every check.
- `canonical_state_fingerprint` should hash only scheduler-relevant fields. It is used for stale-session detection, not security.
- The `UNIQUE (id, session_id)` constraint exists so attempts can use a composite FK and prove their `session_card_id` belongs to the same session.

Indexes:

```sql
CREATE INDEX leech_drill_session_cards_user_card_idx
  ON public.leech_drill_session_cards (user_id, card_id)
  WHERE card_id IS NOT NULL;

CREATE UNIQUE INDEX leech_drill_session_cards_session_card_idx
  ON public.leech_drill_session_cards (session_id, card_id)
  WHERE card_id IS NOT NULL;

CREATE INDEX leech_drill_session_cards_leech_idx
  ON public.leech_drill_session_cards (leech_id)
  WHERE leech_id IS NOT NULL;
```

RLS:

- `SELECT`: `auth.uid() = user_id`.
- `INSERT`: `auth.uid() = user_id` as defense in depth; API writes via service role.
- No update/delete policy for normal users.

### New Table: `leech_drill_attempts`

Persist immutable drill-only answer events:

```sql
CREATE TABLE public.leech_drill_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.leech_drill_sessions(id) ON DELETE CASCADE,
  session_card_id uuid NOT NULL,
  leech_id uuid REFERENCES public.leeches(id) ON DELETE SET NULL,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result text NOT NULL CHECK (result IN ('missed', 'hesitated', 'remembered')),
  local_sequence int CHECK (local_sequence IS NULL OR local_sequence >= 0),
  response_time_ms int CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
  shown_at timestamptz,
  answered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id),
  CONSTRAINT leech_drill_attempts_session_card_fk
    FOREIGN KEY (session_card_id, session_id)
    REFERENCES public.leech_drill_session_cards(id, session_id)
    ON DELETE CASCADE,
  CONSTRAINT leech_drill_attempts_answered_after_shown CHECK (shown_at IS NULL OR answered_at >= shown_at)
);
```

Indexes:

```sql
CREATE INDEX leech_drill_attempts_user_created_idx
  ON public.leech_drill_attempts (user_id, created_at DESC, id DESC);

CREATE INDEX leech_drill_attempts_leech_created_idx
  ON public.leech_drill_attempts (leech_id, created_at DESC)
  WHERE leech_id IS NOT NULL;

CREATE INDEX leech_drill_attempts_session_idx
  ON public.leech_drill_attempts (session_id, created_at ASC, id ASC);

CREATE INDEX leech_drill_attempts_session_card_idx
  ON public.leech_drill_attempts (session_card_id, created_at DESC, id DESC);
```

RLS:

- `SELECT`: `auth.uid() = user_id`.
- `INSERT`: `auth.uid() = user_id` as defense in depth; API writes via service role.
- No update/delete policy for normal users.

Do not add drill attempt data to `review_logs`. That table is the immutable audit trail of scheduler-affecting review events.

### Optional New Table: `leech_drill_card_states`

If MVP needs drill reminders, "drilled today" signals, or quick dashboard summaries without scanning all attempts, add a materialized aggregate table:

```sql
CREATE TABLE public.leech_drill_card_states (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  leech_id uuid REFERENCES public.leeches(id) ON DELETE SET NULL,
  drill_status text NOT NULL DEFAULT 'active' CHECK (drill_status IN ('active', 'candidate', 'graduated', 'dismissed')),
  last_drill_at timestamptz,
  next_drill_at timestamptz,
  lifetime_attempts int NOT NULL DEFAULT 0 CHECK (lifetime_attempts >= 0),
  lifetime_remembered int NOT NULL DEFAULT 0 CHECK (lifetime_remembered >= 0),
  current_streak int NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  graduated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id),
  CONSTRAINT leech_drill_card_states_remembered_lte_attempts CHECK (lifetime_remembered <= lifetime_attempts)
);
```

Indexes:

```sql
CREATE INDEX leech_drill_card_states_user_status_idx
  ON public.leech_drill_card_states (user_id, drill_status, updated_at DESC);

CREATE INDEX leech_drill_card_states_next_drill_idx
  ON public.leech_drill_card_states (user_id, next_drill_at)
  WHERE next_drill_at IS NOT NULL AND drill_status = 'active';
```

This table is optional for a minimal drill-only MVP. It becomes valuable when dashboard CTA state, reminders, or cross-session drill analytics need to be fast.

RLS:

- `SELECT`: `auth.uid() = user_id`.
- `INSERT/UPDATE`: `auth.uid() = user_id` as defense in depth; API writes via service role.
- No delete policy for normal users.

## Package / Dependency Assessment

### Is a New Package Needed?

Probably **no** for the leeches list and basic drill support. The feature should use existing API, state, validation, and design-system infrastructure.

A package may become useful only if the unresolved leech list is expected to grow large enough that rendering all rows hurts performance, or if the app does not already have a query/validation standard.

### Candidate Packages to Consider

| Package | Use Case | Recommendation |
|---|---|---|
| `@tanstack/react-virtual` | Virtualize long leech lists if users can accumulate hundreds of unresolved/resolved leeches. | Optional. Do not add for a small paginated list. Add only after real UI performance need is visible. |
| `@tanstack/react-query` | Fetch leech lists/details, drill sessions, resolve mutations, and diagnosis polling. | Use if already installed. Add only if the app lacks a server-state library. |
| `zod` | Validate list filters, drill-session creation, drill-attempt payloads, and diagnosis requests. | Use if it is already the backend/frontend schema standard. |

### Selection Guidance

Start without a new package. Server-side cursor pagination should keep the list small enough for MVP. If later UX requires a "resolved history" view with long local lists, `@tanstack/react-virtual` is the most relevant optional addition. Do not add charting, animation, or queue packages for this feature unless the implementation expands beyond the current plan.

## Testing

### Unit Tests

Add tests for:

- Leech list query parameter schema.
- Cursor encoding/decoding.
- Drill queue selection helper.
- Resolve/reopen service error mapping.
- Entitlement check on diagnosis only.
- Frontend list empty/loading/error/success states.
- Drill result state machine.
- Drill session source, repeat policy, stop rule, and status schemas.
- Canonical state fingerprint helper.
- Drill queue reconstruction from session-card snapshots plus attempts.
- Attempt idempotency by `eventId`.
- Drill summary derivation that separates first-pass accuracy from eventual remembered count.
- Exhaustive handling for drill session states: active, finished, aborted.

### Integration Tests

Add tests with real database state for:

- Listing only the authenticated user's unresolved leeches.
- Resolved leeches leave the unresolved list.
- Orphaned leeches with `card_id = NULL` appear in history/detail but not drill queue.
- Resolve is idempotent or returns a documented conflict.
- Reopen respects the partial unique unresolved index.
- Drill session creation snapshots canonical scheduler state.
- Drill attempts do not insert `review_logs`.
- Drill attempts do not modify `cards.state`, `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, or `last_review`.
- Duplicate drill attempt submission with the same `eventId` is idempotent.
- Drill attempt submission rejects a `sessionCardId` that does not belong to the authenticated user's session.
- Drill attempt submission rejects mismatched `cardId` or `leechId` assertions for the supplied `sessionCardId`.
- Session detail detects stale canonical state after a real review occurs elsewhere.
- Explicit "count this as a review" uses the canonical review path and is the only drill flow that changes `cards` scheduler fields or inserts `review_logs`.
- Deleted cards leave session history readable and disappear from remaining drill queues.
- Free users can list and drill.
- Free users cannot generate diagnosis.
- Paid users can generate diagnosis.

### Scheduler Invariance Tests

Add a focused invariance suite for drill-only behavior:

- Capture a canonical card snapshot before a drill-only sequence.
- Run random or table-driven drill-only attempts.
- Assert the canonical card snapshot is unchanged for all scheduler fields.
- Assert `review_logs` is unchanged.
- Assert due queue and review forecast are unchanged, allowing only normal wall-clock passage if the test does not freeze time.
- Assert canonical analytics that read `review_logs` are unchanged.
- Assert only the drill namespace changed.

Property-based tests are useful here because the bug class is accidental leakage. Generate different card states, lapse counts, drill results, duplicate attempt retries, and session status transitions, then assert drill-only actions are equivalent to a no-op on canonical scheduling state.

### Frontend Verification

Verify:

- Keyboard-only drill works.
- Space/Enter reveal behavior matches review expectations where reused.
- Drill actions use "Missed", "Hesitated", and "Remembered" or equivalent Tomo-voice labels unless they submit real reviews.
- The drill screen visibly communicates "practice only" and "review schedule unchanged" without sounding technical.
- Explicit real-review override is secondary and clearly describes the consequence.
- Japanese content uses `lang="ja"` and semantic furigana.
- Severity and status are not color-only.
- The page does not introduce punitive copy.

## Acceptance Criteria

- Unresolved leeches are visible in a dedicated, filterable learner workflow.
- Learners can drill weak cards without changing canonical FSRS state, `review_logs`, due queues, or review forecasts.
- Drill sessions persist enough state to support deterministic queues, immutable attempts, idempotent retries, and future pause/resume.
- Learners can resolve leeches.
- Paid leech diagnosis is gated; free drill support is not.
- The implementation uses existing leech detection from review RPCs and does not create duplicate leech records.
- Explicit real-review override goes through the normal review submission path and is the only drill action that changes real scheduling.
- Drill analytics are separate from retention/retrievability analytics and use labels such as practice confidence or session accuracy.
- UI follows Tomo's calm, considered, Japanese-first product language.
