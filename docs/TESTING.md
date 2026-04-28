# Testing Strategy
## AI-Enhanced FSRS for Japanese

**Version:** 1.3.0  
**Last Updated:** 2026-04-28

---

## Table of Contents

1. [Test Tiers](#1-test-tiers)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [Running Tests](#4-running-tests)
5. [Mocking Guidelines](#5-mocking-guidelines)
6. [What Not to Test](#6-what-not-to-test)

---

## 1. Test Tiers

Tests are split into two tiers with different locations and requirements.

| Tier | Location | Hits real DB/Redis? | Required env vars |
|---|---|---|---|
| Unit | Co-located in `src/<module>/__tests__/` | No — all external deps mocked | None |
| Integration | Centralized in `tests/integration/` | Yes | Full `.env` with live services |

This separation keeps the unit suite fast and dependency-free while giving integration tests a single place to find and a clear signal that they need real infrastructure.

---

## 2. Unit Tests

### 2.1 Location

Unit tests live in a `__tests__/` subdirectory inside the same folder as the module under test:

```
apps/api/src/
├── middleware/
│   ├── auth.ts
│   ├── rateLimit.ts
│   ├── errorHandler.ts
│   └── __tests__/
│       └── auth.middleware.test.ts
├── services/
│   ├── fsrs.service.ts
│   ├── ai.service.ts
│   └── __tests__/
│       ├── fsrs.service.test.ts
│       └── ai.service.test.ts
├── schemas/
│   ├── auth.schema.ts
│   └── __tests__/
│       └── auth.schema.test.ts
```

The naming rule: `<subject>.test.ts` inside `__tests__/`. Never `<subject>.spec.ts`.

### 2.2 What belongs here

A test is a unit test if it:
- Tests a single function, class, or middleware in isolation
- Mocks every external dependency (Supabase, Redis, OpenAI, Express `req`/`res`)
- Can run without any environment variables or network access
- Completes in milliseconds

**Good unit test targets:**
- Zod schema validation (valid inputs pass, invalid inputs produce the right error shape)
- Pure service functions that transform data (e.g. FSRS state mapping helpers)
- Middleware logic (auth header parsing, error handler response format)
- Utility functions

### 2.3 Example

```typescript
// src/middleware/__tests__/auth.middleware.test.ts
import { describe, it, expect, mock } from 'bun:test'

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    auth: {
      getUser: mock(() =>
        Promise.resolve({ data: { user: null }, error: { message: 'Invalid JWT', status: 401 } })
      ),
    },
  },
}))

const { app }              = await import('../../app.ts')
const { default: request } = await import('supertest')

describe('authMiddleware', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await request(app).post('/api/v1/auth/logout')
    expect(res.status).toBe(401)
  })
})
```

Note the dynamic imports after `mock.module()`. This ordering is required so the mock is registered before the module under test loads its Supabase dependency.

---

## 3. Integration Tests

### 3.1 Location

All integration tests live under a single top-level directory:

```
apps/api/
├── src/
│   └── ...
└── tests/
    └── integration/
        ├── auth.routes.test.ts
        ├── cards.routes.test.ts
        ├── reviews.routes.test.ts
        └── fsrs.service.test.ts
```

### 3.2 What belongs here

A test is an integration test if it:
- Talks to a real Supabase database (reads or writes actual rows)
- Talks to a real Upstash Redis instance
- Exercises a full API route end-to-end (including the database round-trip)
- Requires environment variables from `.env` to be present

**Good integration test targets:**
- Full signup → login → protected-route round trips
- `processReview` persisting FSRS state changes to the database
- Rate limiting behavior across multiple requests
- Supabase RLS policies (verifying that rows are only accessible to their owner)

### 3.3 Setup requirements

Integration tests require:
- A local Supabase instance (`supabase start`) or a dedicated test project
- `apps/api/.env` with valid `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET`
- `apps/api/.env` with valid `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

Run database migrations before the first integration test run:

```bash
supabase db reset   # resets local DB and re-runs all migrations
```

### 3.4 Isolation

Each integration test must leave the database in a clean state:
- Create all test data inside the test
- Delete or roll back that data in an `afterEach` / `afterAll` hook
- Never assume the database is empty at test start
- Use a dedicated test user (created and deleted per test suite, not a shared fixture)

---

## 4. Running Tests

```bash
# All tests (unit + integration, all workspaces)
bun test

# API unit tests only (fast, no env vars required)
bun test apps/api/src

# API integration tests only
bun test apps/api/tests/integration

# Frontend tests only
bun test apps/web

# Watch mode (re-runs on file change)
bun test --watch apps/api/src
```

---

## 5. Mocking Guidelines

### API (Express)

| Dependency | How to mock |
|---|---|
| Supabase client | `mock.module('../../db/supabase.ts', ...)` — register before dynamic `import()` |
| Redis client | `mock.module('../../db/redis.ts', ...)` — same pattern |
| OpenAI client | `mock.module('openai', ...)` |
| Express `req`/`res` | Construct plain objects; use `supertest` for full middleware chains |

### Frontend (React / Next.js)

| Dependency | How to mock |
|---|---|
| API calls | Mock at the `fetch` boundary, not inside TanStack Query hooks |
| Zustand stores | Reset store state in `beforeEach` using the `reset` action |
| Next.js navigation | Use `jest-next-router` or mock `next/navigation` via `mock.module` |

### Rules

- Mock external services (Supabase, Redis, OpenAI) in unit tests — never call them for real.
- Do not mock internal modules (services, utils) in unit tests — if you feel the urge, split the function instead.
- Do not mock the module under test itself.
- Use `mock.restore()` in `afterEach` when a mock changes observable global state.

---

## 6. What Not to Test

- **Implementation details:** test inputs and outputs, not which internal methods were called.
- **Third-party library internals:** trust that `@open-spaced-repetition/binding`, Zod, and Supabase work correctly.
- **Type correctness:** TypeScript catches type errors at compile time; do not write tests that only assert types.
- **Trivial getters/setters:** a function that returns `this.value` does not need a test.
- **The FSRS algorithm math:** `@open-spaced-repetition/binding` has its own test suite; test that `processReview` persists the result correctly, not that the scheduling math is right.

---

*End of Testing Strategy v1.3.0*
