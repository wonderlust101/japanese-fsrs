# CLAUDE.md

This file provides context for AI coding assistants (Claude, Copilot, Cursor, etc.) working in this repository. Read it fully before making any changes.

---

## Project Overview

**AI-Enhanced FSRS for Japanese** is a spaced repetition application built specifically for Japanese learners. It combines a Japanese-aware implementation of the FSRS v5 algorithm with OpenAI gpt-5.4 nano to deliver intelligent card generation, weakness diagnosis, personalized mnemonics, and contextual sentence creation — all in a single self-contained application.

This is a **Bun monorepo** with two main apps:
- `apps/web` — Next.js 15 frontend (App Router)
- `apps/api` — Express 5 REST API backend

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Client State | Zustand 5 |
| Server State | TanStack Query v5 |
| Backend | Express 5, TypeScript |
| Database | Supabase (PostgreSQL) |
| Vector Search | pgvector |
| Cache / Rate Limiting | Upstash Redis |
| AI | OpenAI gpt-5.4 nano (`gpt-5.4-nano`) |
| SRS Algorithm | ts-fsrs |
| Package Manager | Bun (workspaces) |

---

## Repository Structure

```
fsrs-japanese/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   └── api/                    # Express 5 backend
│       └── src/
│           ├── routes/         # Path → controller mapping only
│           ├── controllers/    # Request parsing, response sending
│           ├── services/       # Business logic, DB queries
│           ├── schemas/        # Zod validation schemas
│           ├── middleware/     # Auth, rate limiting, error handler
│           └── db/             # Supabase + Redis clients
├── packages/
│   ├── shared-types/           # Shared TypeScript interfaces
│   └── tsconfig/               # Shared tsconfig base
├── supabase/
│   └── migrations/             # SQL migration files (run in order)
├── bunfig.toml                 # Bun workspace config
└── CLAUDE.md
```

---

## Commands

### Install dependencies
```bash
bun install
```

### Run both apps in development
```bash
bun dev
```

### Run individually
```bash
bun --filter web dev       # Next.js on :3000
bun --filter api dev       # Express on :3001
```

### Build for production
```bash
bun run build
```

### Run tests (Bun's built-in test runner)
```bash
bun test                        # All workspaces
bun --filter api test           # API tests only
bun --filter web test           # Frontend tests only
```

### Type checking
```bash
bun run typecheck
```

### Linting
```bash
bun run lint
bun run lint:fix
```

### Database migrations (Supabase CLI)
```bash
supabase migration new <name>        # Create a new migration
supabase db push                     # Push migrations to remote
supabase db reset                    # Reset local DB and re-seed
```

---

## Environment Variables

### `apps/api/.env`
```
PORT=3001
NODE_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=
LEECH_THRESHOLD=8
DEFAULT_RETENTION_TARGET=0.85
```

`OPENAI_EMBEDDING_MODEL` is optional; defaults to `text-embedding-3-small`. The chosen model **must produce 1536-dim vectors** to match the `cards.embedding vector(1536)` column type. Switching to a model with a different dimension requires a schema migration.

### Operations

After deploying changes that introduce new premade source cards, run the embedding backfill once so `find_similar_cards` returns results for those new cards:

```
bun --filter api run embeddings:backfill
```

Idempotent — only operates on rows where `embedding IS NULL`. Uses the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` env vars; no additional secrets required.

### `apps/web/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Architecture Decisions

### Why Express + Next.js separately?
Next.js API routes are used only for auth callbacks and lightweight proxying. The heavy business logic (FSRS scheduling, AI calls, analytics queries) lives in the Express API so it can be scaled, tested, and deployed independently of the frontend.

### Why Zustand for client state?
The review session must feel instantaneous. Zustand holds the entire review queue in memory and applies optimistic updates before the API responds. TanStack Query handles everything that is server-derived data (decks, analytics, due cards). The two layers do not overlap.

### Why pgvector over a dedicated vector DB?
The semantic similarity feature ("similar cards") does not require billions of vectors. Keeping embeddings in the same Supabase PostgreSQL database avoids a separate service, simplifies queries (join directly with card data), and reduces infrastructure complexity at this scale.

### Why Upstash Redis?
Serverless-compatible, no persistent connection needed. Used for three purposes: AI response caching (reduce OpenAI costs), rate limiting AI endpoints per user, and buffering offline review submissions for batch retry.

### FSRS parameters are per layout
Comprehension, production, and listening layouts have separate `generatorParameters` instances with different `request_retention` targets. Do not consolidate them into a single parameter set — each layout has measurably different forgetting curves in Japanese.

---

## Key Conventions

### TypeScript
- Strict mode is on (`"strict": true`) across all packages. Do not disable it.
- All shared domain types live in `packages/shared-types`. Import from there, not from app-local types, when the type crosses the API/frontend boundary.
- Use `unknown` instead of `any`. If you must widen a type, use a type guard.

### API
- All routes are under `/api/v1/`.
- The API uses a three-layer architecture: **routes → controllers → services**. Routes map paths to controller methods. Controllers handle `req`/`res`. Services hold business logic and never import Express types.
- Every controller handler must call `next(error)` on failure — do not `res.json()` errors directly except in the global error handler.
- Auth middleware (`apps/api/src/middleware/auth.ts`) must be applied to every protected route. Never skip it.
- AI endpoints must go through the rate limiter middleware before the controller handler.

### Database
- Never write raw SQL in route handlers. All queries go through service functions in `apps/api/src/services/`.
- All tables have Row Level Security enabled. When writing new migrations, always add RLS policies. Do not disable RLS.
- FSRS state fields (`stability`, `difficulty`, `due`, `state`, etc.) on the `cards` table must only be updated via `fsrs.service.ts`. Do not update them directly elsewhere.

### Migration conventions
- **Forward-only.** Never edit a migration that has been applied to any remote. The catch-up migration `20260503000004_add_premade_deck_id_to_cards.sql` exists only because the initial schema was edited post-apply — don't repeat that.
- **Indexes on populated tables: prefer `CONCURRENTLY` *only when applying outside* `bunx supabase db push`.** The CLI runs migrations in a pipeline that PG treats as a transaction (SQLSTATE 25001 forbids `CONCURRENTLY` there). For migrations applied via `db push`, use plain `CREATE INDEX` / `DROP INDEX` and accept the brief SHARE lock — it's sub-second on our current data sizes. If you need true online indexing on a large table, split each statement into its own migration file and apply via `psql` directly (or `bunx supabase db remote commit` workflows).
- **CHECK constraints on populated tables use `NOT VALID + VALIDATE`.** First `ADD CONSTRAINT … CHECK (…) NOT VALID` (cheap, no scan), then `ALTER TABLE … VALIDATE CONSTRAINT …` separately so the validation lock is brief and isolated.
- **Every new SECURITY DEFINER function needs an explicit `GRANT EXECUTE … TO service_role`** in the same migration. Supabase's auto-grant machinery doesn't fire for `supabase db push`; without the explicit grant, callers hit `42501`.
- **Backfills with `INSERT … SELECT` filter against the FK target** (e.g. `LEFT JOIN cards … WHERE cards.id IS NOT NULL`). `ON CONFLICT DO NOTHING` only catches PK conflicts, not FK violations — an unknown UUID in a source array will abort the whole migration.
- **`ALTER TYPE … ADD VALUE` is irreversible** without rebuilding the type. Use `ADD VALUE IF NOT EXISTS` so `supabase db reset` is re-runnable; document the addition in a comment block at the top of the migration.
- **Destructive column drops require an explicit comment** stating either "no data exists at this point" or naming the column whose values are being preserved. Never drop a `NOT NULL` content column without first proving the data is either gone or migrated.
- **Pin `SET search_path = ''` on every SECURITY DEFINER function**, and fully qualify references (`public.cards`, `public.review_logs`, …). Triggers invoked by SECURITY DEFINER functions inherit the empty search path; trigger functions must do the same.

### Frontend
- Use the App Router only. Do not add anything to `pages/`.
- Do not call the OpenAI API or Supabase directly from client components. All AI calls go through the Express API. Supabase is only called client-side for auth session management.
- Do not use `useEffect` for data fetching. Use TanStack Query hooks.
- Review session state lives entirely in `useReviewSessionStore` (Zustand). Do not lift it into React state or TanStack Query.

### Styling
- Tailwind CSS only. Do not add inline styles or CSS modules unless there is a very specific reason (e.g. a CSS animation that Tailwind can't express).
- Japanese text must use a CJK-capable font stack. The root layout sets this. Do not override the font family on individual components.
- Furigana rendering uses the `<FuriganaText>` component. Do not use raw `<ruby>` tags elsewhere.

### AI Prompts
- All prompts live in `apps/api/src/services/ai.service.ts`. Do not inline prompts in route handlers.
- Card generation must use `response_format: { type: 'json_object' }` and parse the response. Always validate the shape before returning to the client.
- Never pass raw user input directly into a prompt without sanitization. Strip HTML and trim whitespace first.

---

## FSRS Quick Reference

The FSRS state machine has 4 states:

| State | Value | Description |
|---|---|---|
| New | 0 | Never reviewed |
| Learning | 1 | Recently introduced, short intervals |
| Review | 2 | In long-term memory, graduated |
| Relearning | 3 | Lapsed, being relearned |

Ratings map to `ts-fsrs` `Rating` enum:
- `1` = Again
- `2` = Hard
- `3` = Good
- `4` = Easy

Always use the `Rating` enum constants from `ts-fsrs`, not raw integers.

### FSRS Service Functions (`fsrs.service.ts`)

| Function | Description | DB writes |
|---|---|---|
| `processReview(cardId, rating, userId, ms?)` | Normal review — schedules next interval via `f.next()` | Yes (RPC) |
| `rollbackReview(cardId, userId, logId)` | Undo a specific review log; restores card to before-snapshot | Yes (direct update) |
| `forgetCard(cardId, userId, resetCount?)` | Reset card to New state (Anki Forget) | Yes (RPC) |
| `getRetrievability(stability, elapsedDays)` | Current recall probability (0–1) | None (pure math) |
| `previewNextStates(row, cardType, now?)` | Preview all 4 rating outcomes without committing | None (pure math) |
| `rescheduleFromHistory(cardId, userId)` | Replay full review history to recompute schedule | Yes (RPC) |
| `getInitialFsrsState()` | Default field values for a new card row | None |

---

## Common Pitfalls

- **Use `f.next()` for all normal reviews, not `f.repeat()`.** `f.repeat()` computes all 4 rating outcomes simultaneously and is only valid inside `previewNextStates()`. Never call `f.repeat()` for an actual user review — it does not persist state and calling it more than once is not idempotent.
- **Never pass `rating: 'manual'` from a user review submission.** It is only valid for `forgetCard()` and `rescheduleFromHistory()` internal operations. Reject `'manual'` at the Zod schema layer on the submit-review route.
- **Rollback requires non-null `state_before` in the review log.** Logs written before migration `20260502000001` have null before-snapshots and cannot be rolled back — `rollbackReview()` throws 409 for those.
- **Per-layout FSRS instances are separate objects baked with their `request_retention` at construction.** Do not share instances across layouts.
- **Linked Card Sync:** When updating content fields (`word`, `reading`, `meaning`) on a card, those shared values must propagate to all sibling cards via `syncSharedFields` in `card.service.ts`. When updating FSRS state, synchronize `stability` and `difficulty` to sibling cards to prevent redundant reviews.
- **Leech detection runs inside `processReview` in `fsrs.service.ts`.** Do not add leech checks elsewhere or you will get duplicate leech records.
- **TanStack Query cache keys must be arrays.** `queryKey: 'due'` is wrong; `queryKey: ['reviews', 'due']` is correct.
- **Zustand actions must be inside the `actions` sub-object** in each store definition. Do not add actions at the top level of the store interface.
- **pgvector queries use `<=>` (cosine distance), not `<->` (L2 distance).** The embedding index is built for cosine. Switching operators will not use the index.
- **Supabase service role key must never be exposed to the client.** It bypasses RLS. It lives only in `apps/api/.env`, never in `apps/web/.env.local`.
- **`jlpt_level` is a 6-value enum: `N5`, `N4`, `N3`, `N2`, `N1`, `beyond_jlpt`.** Do not use `null` to mean "not on JLPT" — use `beyond_jlpt` explicitly. The `beyond_jlpt` value covers native-level, domain-specific, and literary vocabulary not on any JLPT list.
- **Premade deck cards have `user_id = NULL`.** When a user subscribes to a premade deck, the subscription service creates personal copies of each card with FSRS state initialized to `new`. Never mutate the source premade cards — they are shared across all users.
- **Do not allow FSRS state updates on premade deck source cards.** The `processReview` service must check `user_id != NULL` before writing. Only personal card copies should ever have FSRS state written.

---

## Non-Priority Features (Do Not Implement Unless Explicitly Asked)

The following features are documented in the PRD but are intentionally deferred. Do not implement them, suggest implementing them, or scaffold code for them without explicit instruction:

- Browser extension for sentence mining
- Subtitle / SRT file mining
- Frequency-aware imports from external sources
- In-app reading mode with popup dictionary
- Immersion time tracker
- Shadowing mode (pronunciation recording + AI feedback)
- All social and community features (shared decks, mnemonic voting, study groups)

---

### Documentation Map
Always refer to these files in the `/docs` directory before suggesting architectural changes or new features:
- **Product Requirements:** [docs/PRD.md](./docs/PRD.md) - Features, user stories, and project scope.
- **Technical Design:** [docs/TDD.md](./docs/TDD.md) - System architecture and FSRS implementation details.
- **Design Specs:** [docs/UX-UI-SPEC.md](./docs/UX-UI-SPEC.md) - Visual guidelines and component behaviors.
- **Coding Standards:** [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) - Linting, naming, and PR guidelines.

---

*Last updated: 2026-04-24*
