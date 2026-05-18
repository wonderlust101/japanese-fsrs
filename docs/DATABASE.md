# Database Schema Reference

This document describes every table in the Supabase (PostgreSQL) database, the purpose of each column, and the constraints, indexes, triggers, and RPCs that govern them.

> **Generated from:** migrations in `supabase/migrations/` through `20260530000000`.
> **Database:** Supabase PostgreSQL with the `pgvector` extension.
> **Convention:** All wire formats are camelCase; all DB columns are snake_case. The transform happens at the service layer (`toRow` / `toCardRow` / `toPremadeRow` for responses; explicit patch maps for inputs).

---

## Table of Contents

- [Conventions & Cross-Cutting Concerns](#conventions--cross-cutting-concerns)
- [Enum Types](#enum-types)
- [Roles & Privileges](#roles--privileges)
- [Tables](#tables)
  - [`profiles`](#table-profiles)
  - [`user_interests`](#table-user_interests)
  - [`premade_decks`](#table-premade_decks)
  - [`decks`](#table-decks)
  - [`cards`](#table-cards)
  - [`review_logs`](#table-review_logs)
  - [`leeches`](#table-leeches)
  - [`leech_drill_sessions`](#table-leech_drill_sessions)
  - [`leech_drill_session_cards`](#table-leech_drill_session_cards)
  - [`leech_drill_attempts`](#table-leech_drill_attempts)
  - [`idempotency_keys`](#table-idempotency_keys)
- [SECURITY DEFINER Functions / RPCs](#security-definer-functions--rpcs)
- [Triggers](#triggers)
- [Relationships Overview](#relationships-overview)
- [Key Design Decisions](#key-design-decisions)

---

## Conventions & Cross-Cutting Concerns

### Row-Level Security (RLS)
Every application table has RLS enabled. The default access patterns are:

| Role | Use case | Bypass RLS? |
|---|---|---|
| `service_role` | Used by the Express API via `supabaseAdmin`. | **Yes** |
| `authenticated` | Used by the Next.js client (auth session only). | No — RLS policies apply. |
| `anon` | Pre-login browse of `premade_decks` only. | No. |

The Express API speaks to the database exclusively through `service_role`. RLS policies on application tables are therefore **defense-in-depth**: they prevent privilege escalation if the service-role key ever leaks but they are not the primary authorization layer. Authorization is enforced at the API boundary by `auth.middleware.ts`.

### `SECURITY DEFINER` functions
Most multi-step writes are wrapped in PL/pgSQL functions marked `SECURITY DEFINER` so they execute with the function owner's privileges (typically `postgres`) rather than the caller's. Every such function:
- Pins `SET search_path = ''` and fully qualifies references (`public.cards`, `public.review_logs`, …) to defeat search-path injection.
- Has an explicit `GRANT EXECUTE … TO service_role` in the same migration (Supabase's auto-grant doesn't fire for `supabase db push`).
- Performs its own ownership check against `p_user_id` rather than relying on `auth.uid()` (the API authenticates first, then trusts the parameter).

### Statement & lock timeouts
The `service_role` connection has `statement_timeout = '10s'` and `lock_timeout = '2s'` (migration `20260512000000`). These compose under the 10s `supabase-js` fetch timeout in `apps/api/src/db/supabase.ts`.

### Migration discipline
- **Forward-only.** Never edit a migration that has been applied to any remote.
- **Indexes on populated tables:** prefer plain `CREATE INDEX` (sub-second SHARE lock at current scale). Use `CONCURRENTLY` only when applying outside `bunx supabase db push` because the CLI runs migrations inside an implicit transaction (SQLSTATE 25001 forbids `CONCURRENTLY` there).
- **CHECK constraints on populated tables:** use `NOT VALID + VALIDATE` (cheap add, isolated validation lock).
- **Backfills:** filter against the FK target with `LEFT JOIN ... WHERE … IS NOT NULL` — `ON CONFLICT DO NOTHING` only catches PK conflicts, not FK violations.

---

## Enum Types

| Enum | Values | Used By |
|---|---|---|
| `card_type` | `comprehension`, `production`, `listening` | `cards.card_type` |
| `layout_type` | `vocabulary`, `grammar`, `sentence` | `cards.layout_type` |
| `jlpt_level` | `N5`, `N4`, `N3`, `N2`, `N1`, `beyond_jlpt` | `cards`, `premade_decks`, `profiles.jlpt_target` |
| `deck_type` | `vocabulary`, `kanji`, `mixed` | `decks`, `premade_decks` |
| `review_rating` | `again`, `hard`, `good`, `easy`, `manual` | `review_logs.rating` |

> `review_rating.manual` is only written by `process_forget()` (Anki Forget) and `rescheduleFromHistory()` internally. User-facing review submissions must be `again`/`hard`/`good`/`easy` and are rejected at the Zod schema layer.
>
> `jlpt_level.beyond_jlpt` covers native-level, domain-specific, and literary vocabulary not on any JLPT list. Do **not** use `NULL` to mean "not on JLPT" — use `beyond_jlpt` explicitly.
>
> `card_type` was migrated from a 5-value old enum (`recognition`, `production`, `reading`, `audio`, `grammar`) to the current 3-value modality enum in migration `20260502000004`. The old `deck_type` value `'grammar'` was removed in `20260520000000`.

---

## Roles & Privileges

Set in migration `20260511000000_grant_table_privileges.sql`. Supabase's automatic per-table grant machinery does not fire when migrations are applied via `supabase db push`, so grants must be explicit.

| Table | `service_role` | `authenticated` | `anon` |
|---|---|---|---|
| `profiles` | ALL | SELECT, UPDATE | — |
| `user_interests` | ALL | SELECT, INSERT, UPDATE, DELETE | — |
| `decks` | ALL | SELECT, INSERT, UPDATE, DELETE | — |
| `cards` | ALL | SELECT, INSERT, UPDATE, DELETE | — |
| `review_logs` | ALL | SELECT, INSERT | — |
| `leeches` | ALL | SELECT, INSERT, UPDATE | — |
| `leech_drill_sessions` | ALL | SELECT, INSERT, UPDATE | — |
| `leech_drill_session_cards` | ALL | SELECT, INSERT | — |
| `leech_drill_attempts` | ALL | SELECT, INSERT | — |
| `premade_decks` | ALL | SELECT | SELECT |
| `idempotency_keys` | (via SECURITY DEFINER RPCs only) | — | — |

`profiles` deliberately omits `INSERT` from `authenticated` — rows are created exclusively by the `handle_new_user()` trigger. RPCs grant `EXECUTE` to `service_role` only; the API is the only legitimate caller.

---

## Tables

### Table: `profiles`

Extends `auth.users` with application-specific user preferences. Exactly one row per auth user, created automatically by the `handle_new_user()` trigger when a Supabase auth user signs up.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | — | Primary key. FK to `auth.users(id)` — cascades on user deletion. |
| `native_language` | `TEXT` | NO | `'en'` | User's native language. ISO 639-1 (`en`), 639-3 (`eng`), with optional region (`en-US`) or script (`zh-Hans`) subtag. Validated by `profiles_native_language_iso639` CHECK. Used by the AI for mnemonic and explanation language selection. |
| `jlpt_target` | `jlpt_level` | YES | `NULL` | The JLPT level the user is targeting. Drives JLPT-gap analytics and milestone forecast RPCs. |
| `study_goal` | `TEXT` | YES | `NULL` | Free-form user-provided goal text. Displayed on the dashboard. |
| `daily_new_cards_limit` | `INT` | NO | `20` | Maximum new cards introduced per day. Enforced by `get_due_cards()` and applied to today's bucket + future-day projection in `get_review_forecast()`. CHECK ≥ 0. |
| `daily_review_limit` | `INT` | NO | `200` | Maximum review cards shown per day. Enforced by `get_due_cards()` and applied to today's bucket in `get_review_forecast()`. CHECK ≥ 0. |
| `retention_target` | `FLOAT` | NO | `0.85` | Target recall probability (0–1) used as the global fallback for FSRS scheduling. CHECK `> 0 AND <= 1`. Per-layout FSRS instances may override this with their own `request_retention`. |
| `timezone` | `TEXT` | NO | `'UTC'` | IANA timezone string (e.g. `Asia/Tokyo`, `Etc/GMT+8`). Validated by `profiles_timezone_iana` CHECK. Used to compute learner-local day boundaries for daily review caps, heatmap buckets, forecast buckets, and dashboard calendar copy. |
| `version` | `INT` | NO | `1` | Optimistic-concurrency counter. Incremented by `update_profile_with_interests()` on every successful PATCH. Required as `If-Match` header on `PATCH /api/v1/profile`. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Auto-maintained by `profiles_updated_at` trigger on every UPDATE. |

**CHECK constraints:**
- `profiles_retention_target_range`: `retention_target > 0 AND retention_target <= 1`
- `profiles_daily_new_cards_limit_nonneg`: `daily_new_cards_limit >= 0`
- `profiles_daily_review_limit_nonneg`: `daily_review_limit >= 0`
- `profiles_timezone_iana`: regex `^UTC$|^[A-Za-z]+(/[A-Za-z0-9_+\-]+)+$` — accepts UTC and any `Region/Subregion[/...]` identifier including `Etc/GMT+N`. Membership in `pg_timezone_names` cannot be enforced (it's a STABLE view, not IMMUTABLE).
- `profiles_native_language_iso639`: regex `^[a-z]{2,3}(-([A-Z]{2}|[A-Z][a-z]{3}))?$` — accepts ISO 639-1/639-3 with optional region or script subtag.

**RLS policies:**
- SELECT: `auth.uid() = id`
- UPDATE: `auth.uid() = id` (USING + WITH CHECK)
- INSERT: blocked entirely; only the `handle_new_user()` trigger can insert.

**Common writes:**
- `INSERT` from `handle_new_user()` trigger on `auth.users` insert.
- `UPDATE` via `update_profile_with_interests(p_user_id, p_expected_version, p_patch, p_interests)` RPC.

---

### Table: `user_interests`

Normalized junction table storing the user's declared interests (e.g. `'anime'`, `'cooking'`, `'business-japanese'`). Replaces the `profiles.interests TEXT[]` column removed in migration `20260504000007`. The AI uses interests when generating contextual example sentences.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `user_id` | `UUID` | NO | — | Part of composite PK. FK to `profiles(id)` — cascades on user deletion. |
| `interest` | `TEXT` | NO | — | Part of composite PK. A single interest tag string (free-form). |

**Primary key:** `(user_id, interest)` — guarantees deduplication.

**RLS policy:** `auth.uid() = user_id` for ALL operations (SELECT, INSERT, UPDATE, DELETE).

**Common writes:**
- Replaced wholesale (DELETE + INSERT) by `update_profile_with_interests()` RPC. Passing `p_interests = NULL` leaves rows untouched; `'{}'` clears the set; `ARRAY[...]` replaces the set.

---

### Table: `premade_decks`

Curated, system-owned decks provided by the application. `user_id` is never set on these rows — they belong to no individual user. Users **copy** a premade deck into their library via `copy_premade_deck()`, which creates a new `decks` row plus personal card copies. The copy is a fully owned, standalone deck — there is no ongoing link back to the source for content updates. If a user wants newer content, they delete their deck and copy again, accepting the loss of FSRS progress as the explicit cost. Premade source rows are never mutated by users.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `name` | `TEXT` | NO | — | Human-readable deck name (e.g. `'JLPT N5 Vocabulary'`). |
| `description` | `TEXT` | YES | `NULL` | Optional longer description shown on the premade-deck browse page. |
| `deck_type` | `deck_type` | NO | — | Category of content: `vocabulary`, `kanji`, or `mixed`. |
| `jlpt_level` | `jlpt_level` | YES | `NULL` | JLPT level the deck targets, if applicable. Used to filter premade decks by JLPT goal. |
| `domain` | `TEXT` | YES | `NULL` | Optional subject domain (e.g. `'business'`, `'anime'`). Used for filtering. |
| `card_count` | `INT` | NO | `0` | Denormalized count of source cards. Maintained automatically by `update_deck_card_count()` trigger. CHECK ≥ 0. |
| `is_active` | `BOOLEAN` | NO | `TRUE` | Catalog visibility flag — **the canonical lifecycle**. Premade decks are NEVER hard-deleted in normal ops; this boolean is toggled instead. When `FALSE`, the deck is hidden from the browse page and no new copies are accepted. Existing user copies are unaffected — they are already standalone decks. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Auto-maintained by `premade_decks_updated_at` trigger. |

**CHECK constraints:**
- `premade_decks_card_count_nonneg`: `card_count >= 0`

**Cascade asymmetry note:** If a premade deck IS hard-deleted (admin-only path), `decks.source_premade_id` is set to NULL (user copies survive — they're already standalone) and `cards.premade_deck_id` cascades (source cards vanish; user-owned copies of those cards are not affected because they live under `deck_id`, not `premade_deck_id`). The user keeps their deck and their FSRS progress; only the attribution link to the original premade deck is severed.

**RLS policies:**
- SELECT: `is_active = TRUE` for all authenticated and anon users.
- INSERT/UPDATE/DELETE: blocked. Premade decks are seeded via migration (`20260504000000_seed_premade_decks.sql`) or admin SQL only.

---

### Table: `decks`

User-owned collections of cards. Each deck belongs to exactly one user. A deck may have been seeded from a premade deck (via `copy_premade_deck()`) or created blank. Once created, all decks are equivalent — there is no behavioral distinction between "copied-from-premade" and "user-built" decks. `source_premade_id` is retained for attribution only.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `user_id` | `UUID` | NO | — | Owner of the deck. FK to `profiles(id)` — cascades on user deletion. |
| `name` | `TEXT` | NO | — | User-visible deck name. |
| `description` | `TEXT` | YES | `NULL` | Optional description shown in the deck list. |
| `deck_type` | `deck_type` | NO | `'vocabulary'` | Category: `vocabulary`, `kanji`, or `mixed`. |
| `is_public` | `BOOLEAN` | NO | `FALSE` | Currently always `FALSE`; public deck behavior must be specified before changing behavior. |
| `source_premade_id` | `UUID` | YES | `NULL` | FK to `premade_decks(id)` — `SET NULL` on premade deletion so the user deck survives. **Attribution only:** set when the deck was created via `copy_premade_deck()` so the UI can show "From: <premade deck name>". Carries no behavioral weight — deck behavior is identical regardless of whether this is set. |
| `card_count` | `INT` | NO | `0` | Denormalized count of cards in this deck. Maintained by `update_deck_card_count()` trigger. CHECK ≥ 0. |
| `version` | `INT` | NO | `1` | Optimistic-concurrency counter. Incremented by `update_deck_with_version_check()` on every successful PATCH. Required as `If-Match` header on `PATCH /api/v1/decks/:id`. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Auto-maintained by `decks_updated_at` trigger. |

**CHECK constraints:**
- `decks_card_count_nonneg`: `card_count >= 0`

**Indexes:**
- `decks_user_updated_idx`: `(user_id, updated_at DESC)` — serves `list_decks_paginated()` ORDER BY index-only.
- `decks_source_premade_id_idx`: `(source_premade_id) WHERE source_premade_id IS NOT NULL` — required for `ON DELETE SET NULL` cascades from `premade_decks`. (Pre-copy-model, this also served a JOIN inside `subscribe_to_premade_deck()`; that RPC has been removed.)

**RLS policies:**
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id` (USING + WITH CHECK as appropriate).

**Common writes:**
- `INSERT`: directly via `POST /api/v1/decks` or via `copy_premade_deck()` RPC.
- `UPDATE`: via `update_deck_with_version_check(p_deck_id, p_user_id, p_expected_version, p_patch)` RPC.
- `DELETE`: directly via `DELETE /api/v1/decks/:id`. All decks delete identically — there is no special branch for premade-derived decks. Cards cascade to the deck delete via FK; the user accepts the loss of FSRS progress as the explicit cost of starting over.

---

### Table: `cards`

The core SRS unit. Every card belongs to exactly one deck — either a user deck (`deck_id` set) or a premade deck (`premade_deck_id` set); the XOR constraint enforces this. Premade source cards have `user_id = NULL` and are shared across all users; personal card copies always have `user_id` set.

This is the **hottest write table** in the system — every review is an UPDATE here.

#### Ownership Columns

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `deck_id` | `UUID` | YES | `NULL` | FK to `decks(id)` — cascades on deck deletion. Set for user-owned cards; `NULL` for premade source cards. |
| `premade_deck_id` | `UUID` | YES | `NULL` | FK to `premade_decks(id)` — cascades on premade deck deletion. Set for premade source cards; `NULL` for user-owned cards. |
| `user_id` | `UUID` | YES | `NULL` | FK to `profiles(id)` — cascades on user deletion. `NULL` for premade source cards. **FSRS state must never be written when this is `NULL`** — `process_review()` and `process_forget()` raise `cannot_review_source_card` / `cannot_forget_source_card` if it is. |

**XOR constraint:** `cards_deck_xor_premade`: `num_nonnulls(deck_id, premade_deck_id) = 1` — exactly one must be non-null.

#### Content Columns

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `layout_type` | `layout_type` | NO | `'vocabulary'` | Determines the shape of `fields_data`. `vocabulary` and `grammar` layouts require `word`, `reading`, and `meaning` keys. `sentence` requires any non-empty object. |
| `fields_data` | `JSONB` | NO | `'{}'` | Card content as a typed JSON object. Shape depends on `layout_type`. For vocabulary/grammar: `{ word, reading, meaning, ...optional fields }`. Validated by `cards_fields_data_shape` CHECK. |
| `card_type` | `card_type` | NO | `'comprehension'` | Review modality: `comprehension` (JP → EN recognition), `production` (EN → JP recall), `listening` (audio/reading comprehension). Each modality uses a separate FSRS parameter instance with its own `request_retention`. |
| `parent_card_id` | `UUID` | YES | `NULL` | Self-referential FK to `cards(id)`. Links sibling cards generated from the same vocabulary item. When `word`, `reading`, or `meaning` change on one sibling, they propagate to all siblings via `update_card_with_sibling_sync()`. `SET NULL` on parent deletion. |
| `jlpt_level` | `jlpt_level` | YES | `NULL` | JLPT classification of the card's vocabulary. Use `beyond_jlpt` for native/domain-specific vocabulary not on any JLPT list — never `NULL` to mean "not on JLPT". |
| `tags` | `TEXT[]` | NO | `'{}'` | User-defined or AI-assigned tags for filtering (e.g. `['N2', 'keigo', 'jlpt-prep']`). |

**Shape CHECK:** `cards_fields_data_shape`:
```sql
(layout_type IN ('vocabulary', 'grammar')
   AND fields_data ? 'word'
   AND fields_data ? 'reading'
   AND fields_data ? 'meaning')
OR
(layout_type = 'sentence' AND fields_data <> '{}'::jsonb)
```

#### FSRS Scheduling Columns

These fields are the live FSRS state and **must only be written via `fsrs.service.ts`** (which calls `process_review()`, `process_forget()`, or `process_review_batch()` RPCs). The `state` integer is the single source of truth for which phase of the SRS cycle the card is in.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `state` | `INT` | NO | `0` | FSRS state: `0`=New, `1`=Learning, `2`=Review, `3`=Relearning. CHECK `BETWEEN 0 AND 3`. Replaces the old `status` enum (dropped in `20260504000004`). |
| `due` | `TIMESTAMPTZ` | NO | `NOW()` | When the card is next due for review. Used by the due-card query. |
| `stability` | `FLOAT` | NO | `0` | FSRS memory stability (half-life in days). Higher = longer review intervals. CHECK ≥ 0. |
| `difficulty` | `FLOAT` | NO | `0` | FSRS item difficulty (0–10). Higher = harder; shorter intervals. CHECK ≥ 0. |
| `elapsed_days` | `INT` | NO | `0` | Days since the previous review, as recorded by ts-fsrs at review time. CHECK ≥ 0. |
| `scheduled_days` | `INT` | NO | `0` | The interval (in days) that was scheduled at the previous review. CHECK ≥ 0. |
| `learning_steps` | `INT` | NO | `0` | Progress through the ts-fsrs v5 learning/relearning step sequence. **Must be persisted** — losing it resets a card in the learning phase back to step 0. CHECK ≥ 0. |
| `reps` | `INT` | NO | `0` | Total number of times this card has been reviewed (all ratings). CHECK ≥ 0. |
| `lapses` | `INT` | NO | `0` | Number of times the card transitioned from Review → Relearning (i.e. "Again" after graduating). Drives leech detection. CHECK ≥ 0 AND `lapses <= reps`. |
| `last_review` | `TIMESTAMPTZ` | YES | `NULL` | Timestamp of the most recent review. `NULL` for cards never reviewed and after `process_forget()`. |
| `is_suspended` | `BOOLEAN` | NO | `FALSE` | When `TRUE`, the card is excluded from review queues. Orthogonal to `state` — a suspended card retains its FSRS state. |

**FSRS CHECK constraints:**
- `cards_stability_nonneg`, `cards_difficulty_nonneg`, `cards_elapsed_days_nonneg`, `cards_scheduled_days_nonneg`, `cards_learning_steps_nonneg`, `cards_reps_nonneg`, `cards_lapses_nonneg`: each `≥ 0`.
- `cards_state_range`: `state BETWEEN 0 AND 3`.
- `cards_lapses_lte_reps`: `lapses <= reps` — logical invariant (a lapse is a subset of a rep).

#### Embedding Columns

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `embedding` | `vector(1536)` | YES | `NULL` | OpenAI `text-embedding-3-small` embedding of the card's content. Used for the "similar cards" feature via cosine distance (`<=>` operator, **never** L2 distance `<->`). `NULL` until the embedding backfill runs. The 1536 dimension is hardcoded to match the default model — switching to a different-dim model requires a schema migration. |
| `embedding_updated_at` | `TIMESTAMPTZ` | YES | `NULL` | When the embedding was last generated. When `embedding_updated_at < updated_at`, the embedding is stale (content changed after embedding was computed). `get_stale_embedding_cards()` returns this set for the regeneration job. |

#### Metadata Columns

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `version` | `INT` | NO | `1` | Optimistic-concurrency counter. Incremented by `update_card_with_sibling_sync()` on every successful PATCH (including on sibling cards). Required as `If-Match` header on `PATCH /api/v1/cards/:id`. Intentionally omitted from list/due projections (only the detail view drives PATCH). |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Row creation timestamp. Used as the FIFO sort key for the new-cards queue. |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Auto-maintained by `cards_updated_at` trigger and explicitly set by FSRS RPCs so `embedding_updated_at < updated_at` staleness checks work correctly. |

#### Indexes

| Index | Columns / Predicate | Purpose |
|---|---|---|
| `cards_pkey` | `(id)` PRIMARY KEY | — |
| `cards_due_active_idx` | `(user_id, state, due) WHERE is_suspended = FALSE` | **Hot path**: serves the overdue branch of `get_due_cards()` (`WHERE user_id = ? AND state IN (1,2,3) AND is_suspended = FALSE AND due <= NOW() ORDER BY due ASC`). |
| `cards_user_new_creation_idx` | `(user_id, created_at) WHERE state = 0 AND is_suspended = FALSE` | **Hot path**: serves the new-cards branch of `get_due_cards()` (FIFO by `created_at ASC`). |
| `cards_deck_pagination_idx` | `(deck_id, created_at DESC, id DESC)` | Makes `list_cards_paginated()` an index-only scan; eliminates in-memory sort on the deck-browser hot path. |
| `cards_user_id_jlpt_level_idx` | `(user_id, jlpt_level) WHERE user_id IS NOT NULL` | Serves `get_jlpt_gap()` and `get_milestone_forecast()` aggregations. |
| `cards_premade_deck_id_idx` | `(premade_deck_id)` | FK enforcement + scan during `copy_premade_deck()` source-card clone. |
| `cards_parent_card_id_idx` | `(parent_card_id)` | Sibling lookup during `update_card_with_sibling_sync()`. |
| `cards_embedding_idx` | `USING hnsw (embedding vector_cosine_ops) WHERE user_id IS NOT NULL` | HNSW index for cosine similarity (`<=>`) in `find_similar_cards()`. Premade source cards are excluded since the RPC filters `user_id = p_user_id`. |

> **Removed indexes (worth knowing):** `cards_user_id_due_idx` (superseded by `cards_due_active_idx`), `cards_tags_gin_idx` (removed in `20260517000000` — no service code filters by tags and GIN write amplification on the hottest write table is expensive), `cards_fields_data_gin_idx` (removed in `20260509000002` — no service code uses JSONB containment).

#### RLS Policies

| Operation | Predicate |
|---|---|
| SELECT | `auth.uid() = user_id OR user_id IS NULL` (own cards + premade source cards) |
| INSERT | `auth.uid() = user_id AND EXISTS (SELECT 1 FROM decks WHERE id = deck_id AND user_id = auth.uid())` |
| UPDATE | `auth.uid() = user_id AND user_id IS NOT NULL` (USING + WITH CHECK) |
| DELETE | `auth.uid() = user_id AND user_id IS NOT NULL` |

---

### Table: `review_logs`

Immutable, append-only audit trail of every review event. A row is inserted by `process_review()`, `process_review_batch()`, or `process_forget()` inside the same transaction as the card FSRS-state UPDATE. **Rows are never updated or deleted by application code.**

`card_id` is **nullable** (`ON DELETE SET NULL`) — when a card is deleted, the FK is cleared so the historical review data is preserved for analytics. This is a deliberate asymmetry from every other FK in the schema; analytics queries must guard against `card_id IS NULL`.

#### Identity Columns

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `card_id` | `UUID` | YES | — | FK to `cards(id)`. `SET NULL` on card deletion to preserve analytics history. |
| `user_id` | `UUID` | NO | — | FK to `profiles(id)`. Cascades on user deletion. |
| `rating` | `review_rating` | NO | — | The rating the user gave: `again`, `hard`, `good`, `easy`. `manual` is written by `process_forget()` only. |
| `review_time_ms` | `INT` | YES | `NULL` | Time the user spent on the card in milliseconds. `NULL` if the client did not report it. CHECK `IS NULL OR >= 0`. |
| `session_id` | `UUID` | YES | `NULL` | Client-generated UUID grouping all reviews from a single study session. Drives `get_session_summary()`. `NULL` for logs written before this column was added. |
| `reviewed_at` | `TIMESTAMPTZ` | NO | `NOW()` | When the review occurred. Used for analytics, learner-local heatmap buckets, daily cap accounting, and time-based reports. |

#### After-Snapshot Columns (always populated)

FSRS state *after* this review was applied.

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `stability_after` | `FLOAT` | NO | Memory stability after this review. |
| `difficulty_after` | `FLOAT` | NO | Item difficulty after this review. |
| `due_after` | `TIMESTAMPTZ` | NO | Next due date scheduled by this review. |
| `scheduled_days_after` | `INT` | NO | Interval in days scheduled by this review. |

#### Before-Snapshot Columns (nullable)

FSRS state *before* this review was applied. Required for `rollbackReview()` in `fsrs.service.ts`. `NULL` for rows written before migration `20260502000001` — those rows are not eligible for rollback (the service raises 409).

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `state_before` | `INT` | YES | FSRS state (0–3) before the review. CHECK `IS NULL OR BETWEEN 0 AND 3`. |
| `stability_before` | `FLOAT` | YES | Memory stability before the review. |
| `difficulty_before` | `FLOAT` | YES | Item difficulty before the review. |
| `due_before` | `TIMESTAMPTZ` | YES | Due date before the review. |
| `scheduled_days_before` | `INT` | YES | Interval in days before the review. |
| `learning_steps_before` | `INT` | YES | Learning step index before the review. |
| `elapsed_days_before` | `INT` | YES | Elapsed days value before the review. |
| `last_review_before` | `TIMESTAMPTZ` | YES | `last_review` timestamp before this review. |
| `reps_before` | `INT` | YES | Total reps before this review. |
| `lapses_before` | `INT` | YES | Total lapses before this review. |

#### Indexes

| Index | Columns / Predicate | Purpose |
|---|---|---|
| `review_logs_pkey` | `(id)` | — |
| `review_logs_user_id_reviewed_at_idx` | `(user_id, reviewed_at)` | Heatmap and daily-quota counts in `get_due_cards()`. |
| `review_logs_card_id_idx` | `(card_id)` | Per-card history join in `get_accuracy_by_layout()` and rollback lookups. |
| `review_logs_session_id_idx` | `(session_id)` | Session-summary lookups. |
| `review_logs_user_graduations_idx` | `(user_id, reviewed_at) INCLUDE (state_before, rating) WHERE rating IN ('good', 'easy') AND state_before IS NOT NULL AND state_before < 2` | Partial covering index for `get_milestone_forecast()` — the "successful graduation" pattern (a learning-phase card answered Good/Easy). |

#### RLS Policies

| Operation | Predicate |
|---|---|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` (defense-in-depth — actual writes go through service-role RPCs) |
| UPDATE/DELETE | **No policy.** Logs are permanently append-only. |

---

### Table: `leeches`

Tracks cards that have lapsed too many times (≥ `LEECH_THRESHOLD`, default 8 — set via `LEECH_THRESHOLD` env var). A leech record is created atomically inside `process_review()` / `process_review_batch()` when the threshold is crossed. The AI then asynchronously fills `diagnosis` and `prescription`.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `card_id` | `UUID` | YES | — | FK to `cards(id)` — `SET NULL` on card deletion (changed from CASCADE in `20260519000000` to mirror `review_logs` and preserve AI-generated text for analytics). |
| `user_id` | `UUID` | NO | — | FK to `profiles(id)` — cascades on user deletion. |
| `diagnosis` | `TEXT` | YES | `NULL` | AI-generated explanation of *why* this card is a leech (e.g. "Confuses okurigana with similar kanji"). Populated asynchronously by `ai.service.ts`. |
| `prescription` | `TEXT` | YES | `NULL` | AI-generated advice for fixing the leech (e.g. "Use the memory-palace technique for the radical"). Populated alongside `diagnosis`. |
| `session_id` | `UUID` | YES | `NULL` | The review session in which the leech was first triggered. Written by `process_review()` so `get_session_summary()` can match leeches to sessions exactly rather than using a time-window heuristic. `NULL` for legacy rows. |
| `resolved` | `BOOLEAN` | NO | `FALSE` | `TRUE` after the user marks the leech as resolved (e.g. after using the prescription). |
| `resolved_at` | `TIMESTAMPTZ` | YES | `NULL` | When `resolved` was set to `TRUE`. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | When the leech was first detected. |

**Partial unique index:** `leeches_card_user_unresolved_idx`: `UNIQUE (card_id, user_id) WHERE resolved = FALSE` — prevents duplicate unresolved leech records under race conditions. Note: PG treats `NULL` as distinct in UNIQUE, so multiple orphan rows (where `card_id = NULL` after card deletion) can coexist for the same `(user_id, resolved=FALSE)` combo, which is correct (they don't logically conflict).

**Other indexes:**
- `leeches_card_id_idx`: `(card_id)` — per-card lookup.
- `leeches_user_id_unresolved_idx`: `(user_id) WHERE resolved = FALSE` — "list user's open leeches" hot path. The unique partial index can't serve this because it leads with `card_id`.
- `leeches_session_id_idx`: `(session_id) WHERE session_id IS NOT NULL` — session-summary join.

**Application-side guard:** Leech detection runs inside `process_review` (and `process_review_batch`) via the `IF p_lapses >= p_leech_threshold` block. Do **not** add leech checks elsewhere or you'll get duplicates.

**RLS Policies:**

| Operation | Predicate |
|---|---|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` (defense-in-depth) |
| UPDATE | `auth.uid() = user_id` (for resolving) |
| DELETE | **No policy.** |

---

### Table: `leech_drill_sessions`

Persisted envelope for one focused drill run (Stage 3 of the leech-drill feature, added in migration `20260531000000_leech_drill_sessions.sql`). Created via the `create_leech_drill_session()` RPC. Drilling is a *parallel SRS namespace* — these sessions never write to `cards` or `review_logs`.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `user_id` | `UUID` | NO | — | FK to `profiles(id)` — cascades on user deletion. |
| `source` | `TEXT` | NO | — | What populated the queue. CHECK admits `unresolved_leeches`, `high_lapse_candidates`, `deck_scoped`, `manual_selection`, `current_card`; Stage 3 only writes the first two. Wire payloads use camelCase (`unresolvedLeeches`, `deckScoped`); the service layer maps. |
| `source_query` | `JSONB` | NO | `'{}'::jsonb` | Frozen filter snapshot (`deckId`, `jlptLevel`, `cardType`, `order`, `limit`) for analytics. CHECK enforces `jsonb_typeof = 'object'`. |
| `mode` | `TEXT` | NO | `'practice'` | `practice` (default) or `timed` (reserved). Stage 3 only writes `practice`. |
| `repeat_policy` | `TEXT` | NO | `'missed_after_lag'` | `none` or `missed_after_lag`. Stored but not yet behaviorally enforced. |
| `stop_rule` | `JSONB` | NO | `'{}'::jsonb` | Reserved for Stage 4+ (max-misses, time cap). CHECK enforces object shape. |
| `status` | `TEXT` | NO | `'active'` | `active` → `finished` or `aborted`. Stage 3 only writes `active`. |
| `started_at` | `TIMESTAMPTZ` | NO | `NOW()` | When the session was created. |
| `finished_at` | `TIMESTAMPTZ` | YES | `NULL` | Set when status transitions to `finished` or `aborted`. CHECK `finished_at >= started_at`. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | — |

**Indexes:**
- `leech_drill_sessions_user_created_idx`: `(user_id, created_at DESC, id DESC)` — user history paging.
- `leech_drill_sessions_user_active_idx`: `(user_id, updated_at DESC, id DESC) WHERE status = 'active'` — Stage 4 resume hot path; partial keeps the index narrow.

**RLS Policies:**

| Operation | Predicate |
|---|---|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` (defense-in-depth) |
| UPDATE | `auth.uid() = user_id` (defense-in-depth — for Stage 5 status transitions) |
| DELETE | **No policy.** |

---

### Table: `leech_drill_session_cards`

Per-card snapshot of canonical FSRS state at the moment a drill session is created. Every queued card writes exactly one row. Used by Stage 4 (resume + staleness detection) and Stage 5 (attempts FK target). Snapshots are immutable by design — no UPDATE/DELETE policy.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `session_id` | `UUID` | NO | — | FK to `leech_drill_sessions(id)` — cascades. |
| `card_id` | `UUID` | YES | — | FK to `cards(id)` — `SET NULL` on card deletion so session history stays inspectable. |
| `leech_id` | `UUID` | YES | — | FK to `leeches(id)` — `SET NULL` on leech deletion. |
| `user_id` | `UUID` | NO | — | Denormalized FK to `profiles(id)` — cascades. Duplicates the session's owner so user-scoped queries and RLS predicates don't have to join through `leech_drill_sessions`. |
| `ordinal` | `INT` | NO | — | Stable position in the session's queue (0-indexed). `CHECK (ordinal >= 0)`. |
| `source_reason` | `TEXT` | NO | — | Why this card was queued. CHECK admits `unresolved_leech`, `high_lapse_candidate`, `manual_selection`, `current_card`; Stage 3 only writes `unresolved_leech`. |
| `baseline_state` | `INT` | NO | — | Snapshot of `cards.state` at session start. `CHECK BETWEEN 0 AND 3` (ts-fsrs states). |
| `baseline_due` | `TIMESTAMPTZ` | NO | — | Snapshot of `cards.due`. |
| `baseline_stability` | `DOUBLE PRECISION` | NO | — | Snapshot of `cards.stability`. `CHECK >= 0`. |
| `baseline_difficulty` | `DOUBLE PRECISION` | NO | — | Snapshot of `cards.difficulty`. `CHECK >= 0`. |
| `baseline_elapsed_days` | `INT` | NO | — | Snapshot of `cards.elapsed_days`. `CHECK >= 0`. |
| `baseline_scheduled_days` | `INT` | NO | — | Snapshot of `cards.scheduled_days`. `CHECK >= 0`. |
| `baseline_learning_steps` | `INT` | NO | — | Snapshot of `cards.learning_steps`. `CHECK >= 0`. |
| `baseline_reps` | `INT` | NO | — | Snapshot of `cards.reps`. `CHECK >= 0`. |
| `baseline_lapses` | `INT` | NO | — | Snapshot of `cards.lapses`. `CHECK >= 0`. |
| `baseline_last_review` | `TIMESTAMPTZ` | YES | — | Snapshot of `cards.last_review` (nullable). |
| `canonical_state_fingerprint` | `TEXT` | NO | — | Version-prefixed md5 hash over the ten `baseline_*` fields (current version: `v1:<32-hex>`). Computed by `public.compute_card_state_fingerprint_v1(...)` — the single source of truth shared by `create_leech_drill_session` (snapshot write) and `get_leech_drill_session` (resume-time staleness check). The `v1:` prefix lets future hash-function changes detect older-version values cleanly. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | — |

**Unique constraints:**
- `(session_id, ordinal)` — stable queue order.
- `(id, session_id)` — composite key referenced by Stage 5's `leech_drill_attempts` via FK `(session_card_id, session_id)`, making cross-session attempt forgery structurally impossible.

**Indexes:**
- `leech_drill_session_cards_user_card_idx`: `(user_id, card_id) WHERE card_id IS NOT NULL` — "did this user drill this card?" lookups.
- `leech_drill_session_cards_session_card_idx`: `UNIQUE (session_id, card_id) WHERE card_id IS NOT NULL` — prevents the same card appearing twice in one queue. Partial so post-deletion orphans (card_id NULL) can coexist.
- `leech_drill_session_cards_leech_idx`: `(leech_id) WHERE leech_id IS NOT NULL` — per-leech drill history.

**RLS Policies:**

| Operation | Predicate |
|---|---|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` (defense-in-depth) |
| UPDATE | **No policy.** |
| DELETE | **No policy.** |

---

### Table: `leech_drill_attempts`

Immutable per-answer event log (Stage 5 of the leech-drill feature, added in migration `20260602000000_leech_drill_attempts.sql`). Created via the `record_leech_drill_attempt()` RPC. Drilling never writes to `cards` or `review_logs` — attempts are the *drill namespace*'s audit trail, fully separate from canonical FSRS history.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key. |
| `event_id` | `UUID` | NO | — | Client-generated domain event identifier. The `(user_id, event_id)` tuple is the authoritative idempotency key. Retrying the same eventId is a no-op at the DB layer (`ON CONFLICT (user_id, event_id) DO NOTHING` in the RPC). |
| `session_id` | `UUID` | NO | — | Direct FK to `leech_drill_sessions(id)` — cascades. Redundant with the composite FK below but documents the cascade intent. |
| `session_card_id` | `UUID` | NO | — | The session-card row the attempt is recorded against. Combined with `session_id` in the composite FK below. |
| `leech_id` | `UUID` | YES | — | FK to `leeches(id)` — `SET NULL` on leech deletion. Always sourced from the session-card row server-side, never from the request body. |
| `card_id` | `UUID` | YES | — | FK to `cards(id)` — `SET NULL` on card deletion. Same server-side sourcing as `leech_id`. |
| `user_id` | `UUID` | NO | — | Denormalized FK to `profiles(id)` — cascades on account deletion. Duplicated from the session for fast user-scoped queries without joining through sessions. |
| `result` | `TEXT` | NO | — | One of `missed`, `hesitated`, `remembered`. Enforced by CHECK. |
| `local_sequence` | `INT` | YES | — | Optional client-side ordering hint (e.g. position within the drill UI). `CHECK >= 0`. |
| `response_time_ms` | `INT` | YES | — | Optional. `CHECK >= 0`. |
| `shown_at` | `TIMESTAMPTZ` | YES | — | When the card front was revealed to the learner. |
| `answered_at` | `TIMESTAMPTZ` | NO | `NOW()` | When the learner submitted the answer. CHECK `shown_at IS NULL OR answered_at >= shown_at`. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | — |

**Unique constraints:**
- `(user_id, event_id)` — DB-enforced eventId idempotency. One row per (user, domain event).

**Foreign-key constraints:**
- `(session_card_id, session_id) REFERENCES leech_drill_session_cards (id, session_id) ON DELETE CASCADE` — **★ the anti-fraud composite FK**. Stage 3 reserved `UNIQUE (id, session_id)` on `leech_drill_session_cards` specifically to make this FK declarable. With it, a client cannot submit an attempt whose `session_card_id` belongs to a *different* session than the URL's — the database rejects the row before any application code runs. This is structural anti-fraud; no TypeScript-level check can be bypassed.
- `session_id REFERENCES leech_drill_sessions(id) ON DELETE CASCADE` — separately declared so attempts cascade cleanly on session delete.

**Indexes:**
- `leech_drill_attempts_user_created_idx`: `(user_id, created_at DESC, id DESC)` — user-scoped history paging.
- `leech_drill_attempts_leech_created_idx`: `(leech_id, created_at DESC) WHERE leech_id IS NOT NULL` — per-leech drill history.
- `leech_drill_attempts_session_idx`: `(session_id, created_at ASC, id ASC)` — replay queue in submission order.
- `leech_drill_attempts_session_card_idx`: `(session_card_id, created_at DESC, id DESC)` — per-card-in-session attempt log.

The UNIQUE on `(user_id, event_id)` doubles as the index that backs `ON CONFLICT (user_id, event_id) DO NOTHING` — no separate index is needed for the idempotency lookup.

**RLS Policies:**

| Operation | Predicate |
|---|---|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` (defense-in-depth) |
| UPDATE | **No policy.** Attempts are append-only by design. |
| DELETE | **No policy.** |

---

### Table: `idempotency_keys`

Per-user replay store for idempotent POST endpoints. Required by:
- `POST /api/v1/reviews/submit`
- `POST /api/v1/reviews/batch`
- `POST /api/v1/decks`
- `POST /api/v1/decks/:deckId/cards`
- `POST /api/v1/cards/:id/regenerate-embedding`
- `POST /api/v1/premade-decks/:id/copy`

Callers include an `Idempotency-Key: <uuid>` header. The same key + same request body → replays the stored response. Same key + different body → 422 conflict. Same key + still in-flight → 409. Keys expire after 24 hours; expired rows are cleaned up lazily on the next `claim_idempotency_key` call for the same user (no pg_cron required at this scale).

This table is accessed **only** by three `SECURITY DEFINER` RPCs — there is no direct read/write path via the user-scoped JWT.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `user_id` | `UUID` | NO | — | Part of composite PK. Scopes keys per-user so two users cannot collide on the same UUID. |
| `key` | `UUID` | NO | — | Part of composite PK. The idempotency key provided by the client in the `Idempotency-Key` header. |
| `request_hash` | `TEXT` | NO | — | Hash of the canonical request body. Used to detect same-key-different-body conflicts (→ 422). |
| `response_status` | `INT` | YES | `NULL` | HTTP status code of the completed response. `NULL` while the request is in-flight. Populated by `store_idempotency_response()`. |
| `response_body` | `JSONB` | YES | `NULL` | Serialized response body. `NULL` while in-flight. Replayed verbatim on duplicate requests. |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | When the key was first claimed. |
| `expires_at` | `TIMESTAMPTZ` | NO | `NOW() + INTERVAL '24 hours'` | TTL. Rows are deleted lazily when `expires_at < NOW()` during the next `claim_idempotency_key` call for the same user. |

**Indexes:**
- `idempotency_keys_pkey`: `(user_id, key)` PRIMARY KEY.
- `idempotency_keys_expires_at_idx`: `(expires_at)` — supports lazy cleanup.

**RLS:** Enabled, but no user-facing policies. Access is exclusively through `SECURITY DEFINER` RPCs granted to `service_role`.

**Lifecycle:**
1. Service handler calls `claim_idempotency_key(p_user_id, p_key, p_request_hash)`. Returns one of:
   - `'fresh'` → caller proceeds to run the worker.
   - `'replay'` → caller returns `(stored_status, stored_body)` to client.
   - `'conflict'` → caller responds 422.
   - `'in_flight'` → caller responds 409.
2. On worker success: `store_idempotency_response(user_id, key, status, body)` writes the result.
3. On worker failure (non-`AppError` exception): `delete_idempotency_key(user_id, key)` releases the placeholder so the caller can retry.

---

## SECURITY DEFINER Functions / RPCs

All RPCs live in the `public` schema and are granted `EXECUTE` to `service_role` only (the API calls them via `supabaseAdmin`).

### FSRS write path

| Function | Purpose | Notes |
|---|---|---|
| `process_review(p_card_id, p_user_id, p_state, p_due, …, p_session_id)` | Atomic FSRS update + `review_logs` insert + leech detection. | Locks the card row with `SELECT … FOR UPDATE` so concurrent reviews of the same card serialize. Raises `card_not_found`, `cannot_review_source_card`, or `card_ownership_mismatch`. |
| `process_review_batch(p_user_id, p_reviews JSONB, p_leech_threshold)` | Batches N `process_review` calls into one round-trip. Per-review subtransactions preserve "collect errors, continue" semantics. | Returns `(card_id, success, error_message, due, stability, difficulty, scheduled_days, state)` per row. |
| `process_forget(p_card_id, p_user_id, …)` | Anki Forget — resets card to `state = 0` and writes a `manual` review log entry. | Same row lock + ownership check as `process_review`. |

### Card writes

| Function | Purpose | Notes |
|---|---|---|
| `update_card_with_sibling_sync(p_card_id, p_user_id, p_expected_version, p_fields_data, p_layout_type, p_card_type, p_tags, p_jlpt_level)` | Atomic target UPDATE + sibling sync of shared fields (`word`, `reading`, `meaning`). Raises `card_version_mismatch` (→ 412) if `version` doesn't match. | Sibling sync only fires when `fields_data` is patched and contains at least one shared key. Increments `version` on the target AND every touched sibling. |
| `bulk_update_card_embeddings(p_updates JSONB)` | Ops-only path used by `backfillPremadeEmbeddings`. Flushes all newly-computed embeddings in one UPDATE. | Skips `SET search_path` because the `vector` type lives in the extensions schema. |
| `get_stale_embedding_cards(p_user_id)` | Returns cards where `embedding_updated_at < updated_at` (content changed after embedding was computed). | Replaces a broken PostgREST `.filter()` call that didn't support column-vs-column comparison. |
| `find_similar_cards(p_card_id, p_user_id, p_limit)` | Cosine-similarity search over the user's own cards. | Uses `<=>` (cosine distance, **not** `<->` L2). Backed by the partial HNSW index. |

### Deck / profile / premade-copy writes

| Function | Purpose | Notes |
|---|---|---|
| `update_deck_with_version_check(p_deck_id, p_user_id, p_expected_version, p_patch JSONB)` | Atomic deck PATCH with version check. Raises `deck_version_mismatch` (→ 412) on stale `If-Match`. | |
| `update_profile_with_interests(p_user_id, p_expected_version, p_patch JSONB, p_interests TEXT[])` | Atomic profile PATCH + interests replace. Closes the silent-wipe-of-interests window. Raises `profile_version_mismatch` (→ 412). | `p_interests = NULL` → leave untouched; `'{}'` → clear; `ARRAY[…]` → replace. |
| `copy_premade_deck(p_user_id, p_premade_deck_id)` | Atomic copy: inserts one new `decks` row owned by `p_user_id` with `source_premade_id = p_premade_deck_id` (attribution only), then bulk-clones every source card into the new deck with fresh FSRS state (`state = 0`, `due = NOW()`, etc.) and copies `embedding` + `embedding_updated_at` from each source row. **Allows duplicates** — calling twice produces two independent decks (the user accepts the storage cost willingly). Validates that the premade deck exists and is `is_active = TRUE`. | Returns `(deck_id, card_count)`. Raises `premade_deck_not_found` (→ 404) when the source is missing or inactive. |

### Read RPCs

| Function | Purpose | Returns |
|---|---|---|
| `get_due_cards(p_user_id, p_daily_review_limit, p_daily_new_cards_limit, p_timezone DEFAULT 'UTC')` | Single-query replacement for the 2-counts + 2-selects review-queue load. Counts today's reviews from learner-local midnight, then returns overdue cards ordered by `due ASC` followed by new cards ordered by `created_at ASC`, both capped by daily limits. | `(id, deck_id, card_type, jlpt_level, state, due, fields_data, layout_type)` |
| `list_cards_paginated(p_user_id, p_deck_id, p_limit, p_cursor, p_status_filter)` | Tuple-cursor pagination over a deck's cards. Uses `(created_at, id) < (cursor_at, cursor_id)` so same-`created_at` neighbours don't straddle page boundaries. | Card detail rows. |
| `list_decks_paginated(p_user_id, p_limit, p_cursor)` | Tuple-cursor pagination over the user's decks, ORDER BY `(updated_at DESC, id DESC)`. | Deck rows. |
| `list_premade_decks_paginated(p_limit, p_cursor, p_deck_type, p_jlpt_level, p_domain)` | Tuple-cursor pagination over active premade decks, ORDER BY `(jlpt_level ASC NULLS LAST, name ASC, id ASC)`. | Premade deck rows. |
| `get_dashboard_data(p_user_id, p_timezone DEFAULT 'UTC')` | Bundles `get_heatmap_data`, `get_accuracy_by_layout`, `get_jlpt_gap`, and `get_milestone_forecast` into one JSONB envelope (4 RPCs → 1 round-trip). Heatmap bucketing uses learner-local days. Migration `20260604000000_remove_legacy_streaks.sql` dropped the legacy `streak` key. | JSONB envelope. |
| `get_session_summary(p_session_id, p_user_id)` | Aggregate stats + leeches-with-card-context for a study session. Filters orphan leeches (`card_id IS NOT NULL`). Internal LIMIT 5000 caps the scan. | JSONB envelope. |
| `get_review_forecast(p_user_id, p_days DEFAULT 14, p_timezone DEFAULT 'UTC', p_daily_review_limit DEFAULT NULL, p_daily_new_cards_limit DEFAULT NULL)` | Learner-local forecast for the next N days. Today's bucket is capped to match `get_due_cards()`: backlog fills first against `remaining_total = daily_review_limit - reviewed_today`, scheduled-today reviews fill the remainder, then new cards fill min(`remaining_new`, what's left of `remaining_total`, inventory). Future days carry actual scheduled `review_count` and a depleting projection of new cards bounded by `daily_new_cards_limit` and remaining inventory. NULL daily limits skip capping (admin/debug only). Migration `20260605000000_review_forecast_daily_caps.sql` reversed the no-projection behaviour introduced by `20260530000000_review_forecast_actual_new_counts.sql`, replacing it with the inventory-bounded projection. | `(date TEXT, count BIGINT, backlog_count BIGINT, review_count BIGINT, new_count BIGINT)` |

### Analytics RPCs

| Function | Purpose | Returns |
|---|---|---|
| `get_heatmap_data(p_user_id, p_timezone DEFAULT 'UTC')` | Per-day counts and retention % for the last 365 learner-local days (days with no reviews are omitted). | `(date TEXT, retention FLOAT, count BIGINT)` |
| `get_accuracy_by_layout(p_user_id)` | Total reviews and successful reviews grouped by `card_type` (modality). | `(layout TEXT, total BIGINT, successful BIGINT)` |
| `get_jlpt_gap(p_user_id)` | Per-JLPT-level totals, learned (state ≥ 2), and currently-due counts. | `(jlpt_level TEXT, total BIGINT, learned BIGINT, due BIGINT)` |
| `get_milestone_forecast(p_user_id)` | Per-JLPT-level projected completion based on 30-day daily learning pace. | `(jlpt_level TEXT, total BIGINT, learned BIGINT, daily_pace NUMERIC, days_remaining INT, projected_completion_date DATE)` |

### Idempotency RPCs

| Function | Purpose |
|---|---|
| `claim_idempotency_key(p_user_id, p_key, p_request_hash)` | Returns `'fresh'`, `'replay'`, `'conflict'`, or `'in_flight'`. Lazily deletes expired rows for the user. |
| `store_idempotency_response(p_user_id, p_key, p_status, p_body)` | Writes the final status + body for a previously-claimed key. |
| `delete_idempotency_key(p_user_id, p_key)` | Releases a placeholder so the caller can retry after a non-`AppError` exception. |

### Leech drill RPCs

| Function | Purpose | Returns |
|---|---|---|
| `compute_card_state_fingerprint_v1(p_state, p_due, p_stability, p_difficulty, p_elapsed_days, p_scheduled_days, p_learning_steps, p_reps, p_lapses, p_last_review)` | `IMMUTABLE LANGUAGE sql` helper. The single source of truth for the `v1:` canonical-state fingerprint. Called by both `create_leech_drill_session` (snapshot write, Stage 3 → replaced in Stage 4 to use the helper) and `get_leech_drill_session` (resume-time staleness check, Stage 4). The Stage 4 migration includes a `DO $$ ... $$` self-test asserting the helper's output against a fixed test vector — any future edit that would invalidate existing stored fingerprints causes the migration to RAISE at apply time. | `text`. Format: `'v1:' || md5(format('%s\|%s\|...', state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, coalesce(last_review::text, '')))`. |
| `create_leech_drill_session(p_user_id, p_source, p_deck_id, p_jlpt_level, p_card_type, p_order, p_limit, p_mode, p_repeat_policy, p_stop_rule, p_source_query, p_card_ids, p_card_id, p_min_lapses)` | Stage 3 of the leech-drill feature; Stage 4 replaced the body to call the fingerprint helper instead of an inline expression; **Stage 6 added three new parameters** (`p_card_ids` for `manual_selection`, `p_card_id` for `current_card`, `p_min_lapses` for `high_lapse_candidates`) and expanded the candidate-selection CTE to a four-branch `UNION ALL` so all five spec source values are now wired through. The Stage 4 fingerprint helper is unchanged — same byte-for-byte output, existing sessions' stored hashes stay valid. Inserts one `leech_drill_sessions` row and N `leech_drill_session_cards` rows (snapshots) atomically. Writes nothing to `cards` or `review_logs` — the scheduler-invariance guarantee is structural. | `JSONB` envelope: `{ sessionId, status, cards: [{ sessionCardId, leechId, cardId, ordinal, layoutType, cardType, fieldsData, lapses }] }`. |
| `get_leech_drill_session(p_user_id, p_session_id)` | Stage 4 of the leech-drill feature. Returns the persisted queue plus an advisory staleness signal computed by recomputing each card's fingerprint via the helper and comparing against the stored baseline on `leech_drill_session_cards`. Orphan rows (card deleted post-snapshot, `card_id IS NULL`) are surfaced via `cardId: null` + `isOrphaned: true` and are NOT counted as stale — there is nothing to compare to. RAISEs `leech_drill_session_not_found` with SQLSTATE `02000` when the session is missing or owned by another user; service layer translates to HTTP 404 `LEECH_DRILL_SESSION_NOT_FOUND`. Reads `cards` and `leech_drill_session_cards` only — no writes to either, no FSRS touched. | `JSONB` envelope: `{ sessionId, status, isCanonicalStateStale, staleCards: [cardId...], cards: [{ sessionCardId, leechId, cardId, ordinal, layoutType, cardType, fieldsData, lapses, isOrphaned, isStale }] }`. |
| `record_leech_drill_attempt(p_user_id, p_session_id, p_event_id, p_session_card_id, p_asserted_card_id, p_asserted_leech_id, p_result, p_local_sequence, p_response_time_ms, p_shown_at, p_answered_at)` | Stage 5 of the leech-drill feature. (1) Reads canonical `card_id` / `leech_id` from `leech_drill_session_cards` keyed on `(session_card_id, session_id)`; verifies the user owns the session-card. RAISEs `leech_drill_session_card_not_found` (SQLSTATE `02000`) on triple mismatch → service maps to HTTP 404 `LEECH_DRILL_SESSION_CARD_NOT_FOUND`. (2) Compares the optional body-side `p_asserted_card_id` / `p_asserted_leech_id` against the canonical values; mismatches RAISE `leech_drill_attempt_card_mismatch` or `leech_drill_attempt_leech_mismatch` (SQLSTATE `22000`) → service maps to HTTP 422 `LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH`. (3) INSERTs with `ON CONFLICT (user_id, event_id) DO NOTHING` for idempotent replay; the row's `leech_id`/`card_id` are always the canonical values, never the body's. (4) Returns the canonical attempt envelope. Reads `leech_drill_session_cards` and `leech_drill_attempts` only — no writes to `cards`, `review_logs`, or any other canonical FSRS table. | `JSONB` envelope: `{ attemptId, eventId, sessionId, sessionCardId, leechId, cardId, result, localSequence, responseTimeMs, shownAt, answeredAt, createdAt }`. |
| `transition_leech_drill_session(p_user_id, p_session_id, p_target_status)` | Stage 6 of the leech-drill feature. Flips `leech_drill_sessions.status` from `'active'` to the requested terminal state (`'finished'` or `'aborted'`) atomically. `FOR UPDATE` lock on the session row guards against concurrent transitions. Idempotent on no-op retries: re-finishing a finished session (or re-aborting an aborted one) returns successfully without touching `finished_at` (preserves the first-finish timestamp). Rejects illegal transitions with `leech_drill_session_state_conflict` (SQLSTATE `22000`) → service maps to HTTP 409 `LEECH_DRILL_SESSION_STATE_CONFLICT`. Missing session → `leech_drill_session_not_found` (SQLSTATE `02000`) → HTTP 404. Writes only `status`, `finished_at`, `updated_at` on `leech_drill_sessions` — no reads or writes against `cards` or `review_logs`. | `VOID`. The service calls `get_leech_drill_session` afterwards to return the post-state envelope, so the wire shape matches the Stage 4 GET response. |

---

## Triggers

| Trigger | Table | Event | Function | Purpose |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-creates a `profiles` row for every new auth user. |
| `profiles_updated_at` | `profiles` | BEFORE UPDATE | `set_updated_at()` | Sets `updated_at = NOW()`. |
| `premade_decks_updated_at` | `premade_decks` | BEFORE UPDATE | `set_updated_at()` | Sets `updated_at = NOW()`. |
| `decks_updated_at` | `decks` | BEFORE UPDATE | `set_updated_at()` | Sets `updated_at = NOW()`. |
| `cards_updated_at` | `cards` | BEFORE UPDATE | `set_updated_at()` | Sets `updated_at = NOW()`. |
| `cards_count_trigger` | `cards` | AFTER INSERT/DELETE | `update_deck_card_count()` | Maintains `decks.card_count` and `premade_decks.card_count` denormalized counters. |

`set_updated_at()` is plain `LANGUAGE plpgsql` (no SECURITY DEFINER needed). `update_deck_card_count()` runs as the table owner via row-level invocation; it dispatches on `NEW.deck_id IS NOT NULL` (user card → updates `decks`) vs `NEW.premade_deck_id IS NOT NULL` (premade source → updates `premade_decks`).

---

## Relationships Overview

```
auth.users
    │
    └── profiles (1:1)
            │
            ├── user_interests              (1:N, cascade)
            ├── decks                       (1:N, cascade)
            │       └── cards               (1:N, cascade)  ←── parent_card_id (self-ref, SET NULL)
            ├── review_logs                 (1:N, cascade)        [card_id is SET NULL on card delete]
            ├── leeches                     (1:N, cascade)        [card_id is SET NULL on card delete]
            └── idempotency_keys            (1:N, no FK — accessed via RPCs)

premade_decks (system-owned, never hard-deleted in normal ops)
    ├── cards (premade source cards: user_id IS NULL, deck_id IS NULL)   [CASCADE]
    └── decks.source_premade_id                                          [SET NULL — user copies survive]
```

**Notable cascade asymmetries:**
- `review_logs.card_id` and `leeches.card_id`: `SET NULL` to preserve analytics/AI-generated text after a card is deleted.
- `decks.source_premade_id`: `SET NULL` so user copies survive a premade hard-delete with attribution severed. The deck and the user's FSRS progress are unaffected because user cards live under `deck_id`, not `premade_deck_id`.

---

## Key Design Decisions

**`cards` dual-FK pattern (`deck_id` XOR `premade_deck_id`):** Premade source cards live in the same table as user-owned cards. The XOR CHECK constraint ensures a card belongs to exactly one "collection" at all times, while `user_id = NULL` signals that a card is a read-only system record. RLS unions both ("`auth.uid() = user_id OR user_id IS NULL`") so a single `SELECT * FROM cards` returns both kinds for browsing.

**`fields_data JSONB` instead of discrete columns:** Card content was consolidated into a single JSONB column (migration `20260502000004`) to support different card layouts (`vocabulary`, `grammar`, `sentence`) without schema changes per layout. The `cards_fields_data_shape` CHECK enforces minimum key presence per `layout_type`. The previously-added `cards_fields_data_gin_idx` was dropped — no service code uses JSONB containment, and the GIN write amplification on the hottest write table was net-negative.

**`state INT` instead of `status` enum:** The ts-fsrs library represents FSRS phase as an integer (0–3). Storing it directly eliminates a translation layer and allows the DB to verify state invariants using arithmetic (e.g. `state >= 2` for "graduated"). Suspension is a separate `is_suspended BOOLEAN` orthogonal to SRS phase.

**`review_logs` before-snapshot:** Storing the full FSRS state before AND after each review enables `rollbackReview()` without re-running history. Rows written before migration `20260502000001` have `NULL` before-snapshots and are not rollback-eligible (the service raises 409).

**FSRS writes go through RPCs, not table updates:** All FSRS state mutations (`process_review`, `process_review_batch`, `process_forget`) acquire `SELECT … FOR UPDATE` row locks before writing, ensuring concurrent reviews of the same card serialize cleanly. Direct UPDATE on FSRS columns from the service layer is an anti-pattern.

**Optimistic concurrency with `version` columns:** `cards`, `decks`, and `profiles` carry an `INT version` column. PATCH endpoints require `If-Match: <version>` and the corresponding RPC raises `*_version_mismatch` (SQLSTATE 22000) on stale snapshots, mapped by the service layer to HTTP 412. List/due projections intentionally omit `version` — only the detail view drives PATCH.

**Premade decks are a starting point, not a strict path:** Users *copy* a premade deck into their library via `copy_premade_deck()`. The result is a fully owned, standalone deck with no ongoing relationship to the source — no subscription row, no version tracking, no sync. To pick up new content from an updated premade deck, the user deletes their deck and copies again, explicitly accepting the loss of FSRS progress. This is a deliberate UX choice: the cost of getting new content is surfaced at exactly the moment the user decides whether the new content is worth it, rather than being hidden behind a "sync" button that could surprise the user with workload they didn't ask for. Duplicate copies are allowed (storage is cheap; the user is in control).

**`idempotency_keys` lazy TTL:** Rather than a background cron job, expired keys are deleted synchronously at the start of each `claim_idempotency_key` call, bounded per-user. This is safe at current scale and requires no pg_cron setup.

**Pagination uses tuple cursors with stable secondary sort:** Every list RPC orders by `(primary_sort_col, id)` and uses tuple comparison (`(c.created_at, c.id) < (v_cursor_at, p_cursor)`) so rows sharing the primary sort value (e.g. cards bulk-cloned by `copy_premade_deck` with `created_at = NOW()`) don't fall through page boundaries.

**Premade decks use `is_active` toggle, not hard-delete:** When a premade deck is retired, flipping `is_active = FALSE` hides it from the browse page without affecting any user's existing copies (copies are independent `decks` rows by design). Hard-delete is admin-only and only severs the `source_premade_id` attribution link via `ON DELETE SET NULL`.

**Statement & lock timeouts on `service_role`:** `statement_timeout = '10s'`, `lock_timeout = '2s'`. These compose under the 10s `supabase-js` fetch timeout to ensure a misbehaving query never hangs the API longer than the upstream HTTP timeout permits.
