# Tomo

Spaced-repetition app for Japanese learners — a Japanese-aware FSRS v5 scheduler
with OpenAI-backed card generation, contextual sentences, and personalized
mnemonics.

Bun monorepo:

- `apps/web` — Next.js 15 frontend (App Router)
- `apps/api` — Express 5 REST API
- `packages/shared-types` — shared Zod schemas + domain types
- `packages/tsconfig` — shared TypeScript base configs

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
