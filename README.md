# Tomo

Spaced-repetition app for Japanese learners — a Japanese-aware FSRS v5 scheduler
with OpenAI-backed card generation, contextual sentences, and personalized
mnemonics.

Bun monorepo:

- `apps/web` — Next.js 15 frontend (App Router)
- `apps/api` — Express 5 REST API
- `packages/shared-types` — shared Zod schemas + domain types
- `packages/tsconfig` — shared TypeScript base configs

## Where things live

```
apps/web/                     Next.js 15 App Router frontend
  app/                        Routes. Groups: (app) authenticated product ·
                              (auth) sign-in/up · (marketing) public landing ·
                              onboarding/ wizard. Route-local UI sits in
                              _components/ (kebab-case) beside its page.
  components/                 Shared design-system components (PascalCase):
                              ui/ · charts/ · icons/ · review/ · srs/ · brand/.
  lib/api/                    TanStack Query hooks + the fetch client.
  lib/actions/                Server actions that call the Express API.
  lib/supabase/               Browser/server clients — auth session only.
  stores/                     Zustand client + review-session state.
  hooks/                      Reusable client hooks.

apps/api/src/                 Express 5 REST API
  routes/ → controllers/ → services/   The request flow: paths map to
                              controllers (req/res) which call services
                              (business logic + DB). Logic never lives in
                              routes or controllers.
  middleware/                 Auth, rate limiting, the global error handler.
  db/                         Supabase + Redis clients.
  lib/                        Cross-cutting infra (logger, circuit breaker,
                              idempotency, retry, timeouts).
  schemas/                    Endpoint-local Zod schemas.

packages/shared-types/        Zod request/response contracts + domain types —
                              the typed API↔web boundary. Import from here.
supabase/migrations/          Forward-only SQL migrations (run in order).
```

**Conventions & deeper docs:** file-naming, state, and accessibility rules live
in [docs/CODING_STANDARDS_FRONTEND.md](./docs/CODING_STANDARDS_FRONTEND.md) and
[docs/CODING_STANDARDS_BACKEND.md](./docs/CODING_STANDARDS_BACKEND.md);
architecture boundaries in [docs/TDD.md](./docs/TDD.md); the schema, RLS, and
RPCs in [docs/DATABASE.md](./docs/DATABASE.md). Start with
[CLAUDE.md](./CLAUDE.md) for the full map.

## Commands

```bash
bun install        # install workspace deps
bun dev            # run web (:3000) + api (:3001)
bun run build      # production build (both apps)
bun test           # unit + schema suites
bun run typecheck  # tsc across all packages
bun run lint       # eslint (@antfu/eslint-config) over the monorepo
bun run db:types   # regenerate apps/api/src/db/database.types.ts from Supabase
```

See [CLAUDE.md](./CLAUDE.md) for architecture, conventions, environment
variables, and the documentation map (product, design, database, testing).
