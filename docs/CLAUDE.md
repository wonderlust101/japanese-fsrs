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

| Layer                   | Technology                                        |
|-------------------------|---------------------------------------------------|
| Frontend                | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Client State            | Zustand 5                                         |
| Server State            | TanStack Query v5                                 |
| Backend                 | Express 5, TypeScript                             |
| Database                | Supabase (PostgreSQL)                             |
| Vector Search           | pgvector                                          |
| Cache / Rate Limiting   | Upstash Redis                                     |
| AI                      | OpenAI gpt-5.4 nano (`gpt-5.4-nano`)              |
| SRS Algorithm (runtime) | ts-fsrs                                           |
| SRS Algorithm (optimizer)        | @open-spaced-repetition/binding                   |
| Package Manager         | Bun (workspaces)                                  |

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

Copy `.env.example` to `.env` in each app before running locally.

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
LEECH_THRESHOLD=8
DEFAULT_RETENTION_TARGET=0.85
```

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

### FSRS parameters are per card type
Comprehension, production, and listening cards have separate `generatorParameters` instances with different `request_retention` targets. Do not consolidate them into a single parameter set — each card type has measurably different forgetting curves in Japanese.

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
- **Ultra-Lean Layouts:** Do not create a database table for layouts. All layouts (Vocabulary, Grammar, Sentence) are defined in the application code. Content is stored in the flexible `fields_data` JSONB column.

### Frontend
- Use the App Router only. Do not add anything to `pages/`.
- Do not call the OpenAI API or Supabase directly from client components. All AI calls go through the Express API. Supabase is only called client-side for auth session management.
- Do not use `useEffect` for data fetching. Use TanStack Query hooks.
- Review session state lives entirely in `useReviewSessionStore` (Zustand). Do not lift it into React state or TanStack Query.
- **Card Rendering:** Render cards using system-defined components based on the `layout_type` and `fields_data`.


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

The FSRS state machine has 4 states (plus a database-level `suspended` status):

| State | Value | Description |
|---|---|---|
| New | 0 | Never reviewed |
| Learning | 1 | Recently introduced, short intervals |
| Review | 2 | In long-term memory, graduated |
| Relearning | 3 | Lapsed, being relearned |

Ratings map to `@open-spaced-repetition/binding` `Rating` enum:
- `1` = Again
- `2` = Hard
- `3` = Good
- `4` = Easy

Always use the `Rating` enum constants from `@open-spaced-repetition/binding`, not raw integers.

---

## Common Pitfalls

- **Do not call `f.repeat()` more than once per review.** It is not idempotent. Call it once, persist the result, and return it.
- **Leech detection runs inside `processReview` in `fsrs.service.ts`.** Do not add leech checks elsewhere or you will get duplicate leech records.
- **Linked Card Sync (v1.3):** Sibling cards sharing a `parent_card_id` must be synchronized. When updating FSRS state for a card, you must synchronize the `stability` and `difficulty` to any sibling cards to prevent redundant reviews.
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
- **Information Architecture:** [docs/IA-WIREFRAME.md](./docs/IA-WIREFRAME.md) - Data flow and UI structure.
- **Design Specs:** [docs/UX-UI-SPEC.md](./docs/UX-UI-SPEC.md) - Visual guidelines and component behaviors.
- **Coding Standards:** [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) - Linting, naming, and PR guidelines.

---

*Last updated: 2026-04-28*
