# CLAUDE.md

This file provides context for AI coding assistants (Claude, Copilot, Cursor, etc.) working in this repository. Read it fully before making any changes.

---

## Project Overview

**Tomo** is a spaced repetition application built specifically for Japanese learners. It combines a Japanese-aware implementation of the FSRS v5 algorithm with OpenAI-backed card generation, contextual sentences, and personalized mnemonics in a single self-contained practice app. Product, brand, visual, and database truth live in `docs/PRODUCT.md`, `docs/DESIGN.md`, and `docs/DATABASE.md`.

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
│           ├── schemas/        # Endpoint-local Zod schemas (shared contracts → packages/shared-types)
│           ├── middleware/     # Auth, rate limiting, error handler
│           └── db/             # Supabase + Redis clients
├── packages/
│   ├── shared-types/           # Shared TS interfaces + Zod request (*.schema) / response (api-*.schema) contracts
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
bun run --filter @fsrs-japanese/web dev   # Next.js on :3000
bun run --filter @fsrs-japanese/api dev   # Express on :3001
```

### Build for production
```bash
bun run build
```

### Run tests (Bun's built-in test runner)
```bash
bun test                                  # All workspaces
bun run --filter @fsrs-japanese/api test   # API tests only
```

The frontend uses **Vitest** (jsdom + MSW), not Bun's runner:

```bash
bun run --filter @fsrs-japanese/web test            # run the web suite
bun run --filter @fsrs-japanese/web test:coverage   # with coverage thresholds (CI gates on this)
bun run --filter @fsrs-japanese/web typecheck
bun run --filter @fsrs-japanese/web lint
```

Detailed testing policy, mocking rules, and integration-test requirements live in [docs/TESTING.md](./docs/TESTING.md).

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

Exact schema, RPC, RLS, and migration rules live in [docs/DATABASE.md](./docs/DATABASE.md).

---

## Environment Variables

### `apps/api/.env`
```
PORT=3001
NODE_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=
OPENAI_CHAT_MODEL_STRUCTURED=
OPENAI_EMBEDDING_MODEL=
WEAK_SPOT_THRESHOLD=8
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

`OPENAI_CHAT_MODEL` is optional; defaults to `gpt-5.4-nano`. Used for card / sentence / mnemonic generation. Swap without a rebuild.

`OPENAI_CHAT_MODEL_STRUCTURED` is optional; when unset it falls back to `OPENAI_CHAT_MODEL`. It is the model used by the **structured/factual** generators (`generateCard`, `generateWeakSpotDiagnosis`) where reading / POS / pitch / kanji-breakdown accuracy outweighs cost. Set it to a stronger model to upgrade only those generators while the rest stay on the cheap default. Resolved in `apps/api/src/services/ai/shared.ts` as `CHAT_MODEL_STRUCTURED`.

The structured generators (card, sentence-card, diagnosis) also run at low temperature (`STRUCTURED_TEMPERATURE = 0.3`) with a fixed `seed` for run-to-run consistency, and validate output through `parseWithRepair` (one corrective retry on malformed JSON, kept inside the breaker so a content failure isn't counted as an outage). The creative generators (sentences, mnemonic, tomo-note, day-reflection) run warm (`CREATIVE_TEMPERATURE = 0.8`, no seed) for variety. All temperature/seed/model constants live in `apps/api/src/services/ai/shared.ts`.

`OPENAI_EMBEDDING_MODEL` is optional; defaults to `text-embedding-3-small`. The chosen model **must produce 1536-dim vectors** to match the `cards.embedding vector(1536)` column type. Switching to a model with a different dimension requires a schema migration.

`CORS_ORIGIN` is optional; it defaults to `http://localhost:3000` and accepts a comma-separated list of absolute origins. `LOG_LEVEL` is optional; when unset, logging defaults to `debug` in development and `info` otherwise.

### Operations

After deploying changes that introduce new premade source cards, run the embedding backfill once so `find_similar_cards` returns results for those new cards:

```
bun run --filter @fsrs-japanese/api embeddings:backfill
```

Idempotent — only operates on rows where `embedding IS NULL`. Uses the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` env vars; no additional secrets required.

### `apps/web/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

`NEXT_PUBLIC_SITE_URL` is the canonical public URL of the site (e.g.
`https://tomo.app`). Used as `metadataBase` in `apps/web/app/layout.tsx` so
Open Graph image URLs and the sitemap entry resolve absolutely. It is validated
by `apps/web/lib/env.ts` and falls back to `http://localhost:3000` when unset,
which is correct for local dev but wrong for any deployed environment — set it
in staging/production.

### Supabase Auth email (SMTP) — project-root `.env`
Auth emails (signup confirmation, password reset, email change) are sent by
Supabase Auth through custom Resend SMTP using branded templates in
`supabase/templates/`. The Supabase CLI reads these from the **gitignored
project-root `.env`** via `env(...)` interpolation in `supabase/config.toml`:

```
SUPABASE_AUTH_SMTP_PASS=        # Resend API key (SMTP password) — secret
SUPABASE_AUTH_SITE_URL=         # canonical site URL for the auth redirect allow-list
```

These are **Supabase-only secrets** — never `NEXT_PUBLIC_*`, never in
`apps/web` or `apps/api`. Production values live in the hosted Supabase
dashboard. Full setup, plain-text copy, and the deliverability checklist are in
[docs/EMAIL.md](./docs/EMAIL.md). The flows are OTP-based, so templates must use
`{{ .Token }}` (the 6-digit code), not `{{ .ConfirmationURL }}`.

---

## Architecture Notes

Keep these architecture boundaries in mind while coding:

- Next.js API routes are only for auth callbacks and lightweight proxying; business logic lives in the Express API.
- Use TanStack Query for server-derived frontend data and Zustand for review/session-local state.
- Keep embeddings in Supabase PostgreSQL with pgvector unless the technical design changes.
- Upstash Redis supports AI response caching, rate limiting, and offline review retry buffering.
- A single FSRS instance schedules every card at `request_retention = 0.88` (raised from `0.85` in migration `20260713000000`; the constant lives in `apps/api/src/services/fsrs/shared.ts` and is mirrored by the `profiles.retention_target` default). The historic per-modality split was collapsed in migration `20260614000000_drop_card_type.sql`; there is no `card_type` column.

---

## Coding Standards

Before making code changes, read and apply the relevant standards:

- **All code changes:** [docs/CODING_STANDARDS.md](./docs/CODING_STANDARDS.md).
- **Frontend changes under `apps/web`:** [docs/CODING_STANDARDS_FRONTEND.md](./docs/CODING_STANDARDS_FRONTEND.md).
- **Backend/API changes under `apps/api`:** [docs/CODING_STANDARDS_BACKEND.md](./docs/CODING_STANDARDS_BACKEND.md).
- **Database, migration, schema, or persistence changes:** [docs/DATABASE.md](./docs/DATABASE.md) plus the backend standards.
- **UI, visual, accessibility, or interaction changes:** [docs/DESIGN.md](./docs/DESIGN.md) plus the frontend standards.

Before finishing code work:

- Verify the touched code against the same standards and report any checks you could not run.
- Check whether documentation changed or needs to change. Update non-brand docs when routes/API behavior, architecture, schema/migrations/RPC/persistence, testing approach, active scope/status, or coding standards change.
- Do not edit [docs/PRODUCT.md](./docs/PRODUCT.md) or [docs/DESIGN.md](./docs/DESIGN.md) unless the user explicitly asks for those files to change. If code changes affect product, brand, or design truth, report the documentation impact and ask before editing those files.

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
- Body and query Zod schemas should reject unknown keys with `.strict()`.
- Wire payloads are camelCase; database columns and SQL RPC parameters are snake_case. Transform at the service layer.
- Retryable mutating POSTs use `Idempotency-Key`; optimistic PATCH routes use `If-Match`. Exact contracts live in [docs/DATABASE.md](./docs/DATABASE.md).
- Rate limiters fail open on Upstash infrastructure failure and are bypassed in development; preserve that availability behavior unless the technical design changes.
- Graceful shutdown must keep readiness/liveness behavior consistent with `apps/api/src/lib/shutdown.ts`.
- Logging: every API line goes through `pino` (`apps/api/src/lib/logger.ts`). Handlers use `req.log` (auto-tagged with `reqId` from `pino-http`); services use `componentLogger('component-name')` from `lib/logger.ts`. Never `console.log` in `apps/api/src` code. Sensitive paths (`email`, `password`, `*token*`, `authorization`/`cookie` headers) are auto-redacted by pino's `redact` config; do not log raw user identifiers — use the `userId` UUID instead. Every request honors `X-Request-ID` (or generates one) and echoes it back as a response header.
- `POST /api/v1/auth/signup` deliberately returns the same 201 shape for fresh and duplicate-email signups (`userId` is null on the duplicate path). This closes the account-enumeration vector — do not "improve" the DX by surfacing a different error for duplicates.

### Database
- Never write raw SQL in route handlers. All queries go through service functions in `apps/api/src/services/`.
- Exact schema, RLS, indexes, triggers, RPCs, FSRS persistence, idempotency, and optimistic concurrency rules live in [docs/DATABASE.md](./docs/DATABASE.md).
- All tables have Row Level Security enabled. New migrations must add matching RLS policies; do not disable RLS.
- FSRS state fields on `cards` must only be updated through `fsrs.service.ts` and the approved database RPCs.

### Migration conventions
- Migrations are forward-only. Never edit a migration that has been applied to any remote.
- Follow [docs/DATABASE.md](./docs/DATABASE.md) for online-indexing, `NOT VALID`, enum, backfill, destructive-drop, and SECURITY DEFINER details.
- Every new SECURITY DEFINER function needs explicit `GRANT EXECUTE ... TO service_role` and pinned `SET search_path = ''`.

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
- All prompts live in the per-generator modules under `apps/api/src/services/ai/` (one file per generator — `card.ts`, `sentences.ts`, `sentence-card.ts`, `mnemonic.ts`, `diagnosis.ts`, `tomo-note.ts`, `day-reflection.ts` — re-exported via `apps/api/src/services/ai.service.ts`; shared infra in `ai/shared.ts`). Do not inline prompts in route handlers.
- Card generation must use `response_format: { type: 'json_object' }` and parse the response. Always validate the shape before returning to the client.
- Never pass raw user input directly into a prompt without sanitization. Strip HTML and trim whitespace first.
- **Keep the generator in sync with `fields_data`.** Any time a new field is added to `WordFieldsSchema`, `ExampleSentenceSchema`, `VocabularyFieldsDataSchema`, `GrammarFieldsDataSchema`, or `SentenceFieldsDataSchema` (`packages/shared-types/src/schemas/field-shapes.schema.ts`), the corresponding generator must be updated in the same PR:
  1. Extend the matching `Generated*Schema` in `packages/shared-types/src/schemas/ai.schema.ts` so structured-output validation admits the field.
  2. Update the prompt body in the matching generator under `apps/api/src/services/ai/` so the model is instructed to produce the field (or explicitly told to omit it when the field requires assets the backend can't host yet, e.g. audio URLs).
  3. Bump the relevant prompt version constant so cached Redis responses for the old prompt are not served after deploy. Every generator now carries one and embeds it in its cache key: `CARD_PROMPT_VERSION`, `SENTENCE_CARD_PROMPT_VERSION`, `DIAGNOSIS_PROMPT_VERSION`, `SENTENCES_PROMPT_VERSION`, `MNEMONIC_PROMPT_VERSION`, `TOMO_NOTE_PROMPT_VERSION`, `REFLECTION_PROMPT_VERSION`. Mirror the pattern established by `DIAGNOSIS_PROMPT_VERSION` in `apps/api/src/services/ai/diagnosis.ts`. (A prompt edit without a version bump silently serves stale cached output until TTL.)
  4. Cover the new field with at least one test fixture in `apps/api/src/services/__tests__/ai.service.test.ts` that asserts the field is admitted on the wire (or correctly omitted when intentionally unmapped).
  A field that ships on the schema without a generator update will only ever be populated through manual card editing — the AI path will continue producing cards without it, and the UI slot will keep rendering empty in production. Treat the schema and the generator as one unit.

## Common Pitfalls

- Exact FSRS state values, RPC behavior, and persistence rules live in [docs/DATABASE.md](./docs/DATABASE.md).
- **Use `f.next()` for all normal reviews, not `f.repeat()`.** `f.repeat()` computes all 4 rating outcomes simultaneously and is only valid inside `previewNextStates()`. Never call `f.repeat()` for an actual user review — it does not persist state and calling it more than once is not idempotent.
- **Never pass `rating: 'manual'` from a user review submission.** It is only valid for `forgetCard()` and `rescheduleFromHistory()` internal operations. Reject `'manual'` at the Zod schema layer on the submit-review route.
- **Rollback requires non-null `state_before` in the review log.** Logs written before migration `20260502000001` have null before-snapshots and cannot be rolled back — `rollbackReview()` throws 409 for those.
- **Linked Card Sync:** When updating content fields (`word`, `reading`, `meaning`) on a card, those shared values must propagate to sibling cards through the `update_card_with_sibling_sync` RPC used by `card.service.ts`.
- **Weak spot detection runs inside `processReview` in `fsrs.service.ts`.** Do not add weak spot checks elsewhere or you will get duplicate weak spot records.
- **TanStack Query cache keys must be arrays.** `queryKey: 'due'` is wrong; `queryKey: ['reviews', 'due']` is correct.
- **Zustand actions must be inside the `actions` sub-object** in each store definition. Do not add actions at the top level of the store interface.
- **pgvector queries use `<=>` (cosine distance), not `<->` (L2 distance).** The embedding index is built for cosine. Switching operators will not use the index.
- **Supabase service role key must never be exposed to the client.** It bypasses RLS. It lives only in `apps/api/.env`, never in `apps/web/.env.local`.
- **`jlpt_level` is a 6-value enum: `N5`, `N4`, `N3`, `N2`, `N1`, `beyond_jlpt`.** Do not use `null` to mean "not on JLPT" — use `beyond_jlpt` explicitly. The `beyond_jlpt` value covers native-level, domain-specific, and literary vocabulary not on any JLPT list.
- **Premade deck cards have `user_id = NULL`.** When a user subscribes to a premade deck, the subscription service creates personal copies of each card with FSRS state initialized to `new`. Never mutate the source premade cards — they are shared across all users.
- **Do not allow FSRS state updates on premade deck source cards.** The `processReview` service must check `user_id != NULL` before writing. Only personal card copies should ever have FSRS state written.

### Documentation Map
Always refer to the canonical docs before suggesting architectural changes, product changes, or design changes:
- **Product:** [docs/PRODUCT.md](./docs/PRODUCT.md) - protected source of truth for users, purpose, business model, brand, product principles, and accessibility commitments. Do not edit unless explicitly asked.
- **Design:** [docs/DESIGN.md](./docs/DESIGN.md) - protected source of truth for visual system, tokens, typography, components, motion, and anti-patterns. Do not edit unless explicitly asked.
- **Database:** [docs/DATABASE.md](./docs/DATABASE.md) - tables, constraints, RLS, indexes, triggers, and RPCs.
- **Coding Standards:** [docs/CODING_STANDARDS.md](./docs/CODING_STANDARDS.md) - mandatory cross-cutting coding standards.
- **Frontend Standards:** [docs/CODING_STANDARDS_FRONTEND.md](./docs/CODING_STANDARDS_FRONTEND.md) - mandatory standards for `apps/web`.
- **Backend Standards:** [docs/CODING_STANDARDS_BACKEND.md](./docs/CODING_STANDARDS_BACKEND.md) - mandatory standards for `apps/api`.
- **Active Board:** [docs/KANBAN_BOARD.md](./docs/KANBAN_BOARD.md) - current project tasks and owner decisions in motion.
- **Backend Completion Plan:** tracked as stage-labelled entries in [docs/KANBAN_BOARD.md](./docs/KANBAN_BOARD.md). Each stage ships as one PR with scoped acceptance criteria; the kanban records the dependency order as Done entries.
- **Testing:** [docs/TESTING.md](./docs/TESTING.md) - test tiers, locations, mocking, and execution guidance.
- **Information Architecture / Wireframes:** [docs/information_architecture/README.md](./docs/information_architecture/README.md) - per-page wireframes (one file per screen) plus the cross-page [sitemap](./docs/information_architecture/00_sitemap.md). Consult before changing page structure, navigation, or adding new screens.

---

*Last updated: 2026-05-28*
