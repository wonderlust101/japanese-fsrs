# Testing Strategy
## Tomo

**Last Updated:** 2026-05-27

---

## Table of Contents

1. [Test Tiers](#1-test-tiers)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [Frontend Component Tests](#4-frontend-component-tests)
5. [End-to-End Tests](#5-end-to-end-tests)
6. [Running Tests](#6-running-tests)
7. [Mocking Guidelines](#7-mocking-guidelines)
8. [What Not to Test](#8-what-not-to-test)

---

## 1. Test Tiers

Tests are split into four tiers with different locations, runners, and requirements.

| Tier | Workspace | Runner | Location | Hits real DB/Redis? | Required env vars |
|---|---|---|---|---|---|
| Unit (API) | `apps/api` | `bun:test` | Co-located in `src/<module>/__tests__/` | No — all external deps mocked | None |
| Integration (API) | `apps/api` | `bun:test` | Centralized in `tests/integration/` | Yes | Full `.env` with live services |
| Unit / Component (Web) | `apps/web` | Vitest + jsdom + React Testing Library + MSW | Co-located in `<dir>/__tests__/` | No — MSW intercepts at the `fetch` boundary | None |
| E2E (Web) | `apps/web` | Playwright | `apps/web/e2e/` | Yes (real Express API + Supabase, depending on flow) | Live web + API stack |

This separation keeps each tier's signal sharp: unit suites stay fast and dependency-free, integration tier owns full DB round-trips, component tier owns user-visible UI behavior under jsdom, and E2E tier owns cross-island browser flows.

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
- Talks to a real Upstash Redis instance for production-gated rate-limit tests
- Exercises a full API route end-to-end (including the database round-trip)
- Requires environment variables from `.env` to be present

**Good integration test targets:**
- Full signup → login → protected-route round trips
- `processReview` persisting FSRS state changes to the database
- Production rate limiting behavior across multiple requests (`NODE_ENV=production`)
- Supabase RLS policies (verifying that rows are only accessible to their owner)

### 3.3 Setup requirements

Integration tests require:
- A local Supabase instance (`supabase start`) or a dedicated test project
- `apps/api/.env` with valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
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

## 4. Frontend Component Tests

### 4.1 Stack

The web workspace uses **Vitest + jsdom + React Testing Library + MSW**. Configuration lives at `apps/web/vitest.config.ts`; the global setup (jest-dom matchers, jsdom shims, `next/navigation` default mock, MSW lifecycle) is in `apps/web/test/setup.ts`. A `renderWithProviders` helper in `apps/web/test/test-utils.tsx` mounts a fresh `QueryClient` per test so failed-fetch cases don't have to wait for retry backoff.

### 4.2 Location

Component and pure-logic tests live in a `__tests__/` subdirectory next to the module under test:

```
apps/web/
├── stores/
│   ├── useReviewSessionStore.ts
│   └── __tests__/
│       └── useReviewSessionStore.test.ts
├── components/review/
│   ├── RatingBar.tsx
│   └── __tests__/
│       └── RatingBar.test.tsx
└── lib/
    ├── offline-queue.ts
    └── __tests__/
        └── offline-queue.test.ts
```

Filename rule: `<subject>.test.ts(x)` inside `__tests__/`. The `.tsx` extension is used when the test mounts components; `.ts` when it only exercises pure logic.

### 4.3 What belongs here

- Zustand store phase transitions, action no-ops, and selector hooks
- Pure logic in `lib/`, `lib/review/`, `app/(app)/**/_components/*.ts`
- React components: forms, dialogs, list views, route-level `*Client` files
- TanStack Query hooks (exercised via the component that consumes them, not directly)

### 4.4 What does NOT belong here

- Async **Server Components** (`app/**/page.tsx` with `async function Page()`). RTL can't render them under jsdom. Test their `*Client` child directly.
- Anything that imports `server-only` or `@/lib/supabase/server`. Those modules belong to the API layer; treat them as boundary modules and integration-test through the Express API instead.
- The marketing landing (GSAP/Lenis scroll choreography). Cover with Playwright + `prefers-reduced-motion: reduce` if needed; jsdom doesn't run layout.

### 4.5 Example

```typescript
// apps/web/stores/__tests__/useReviewSessionStore.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { useReviewSessionStore } from '../useReviewSessionStore'

const { actions } = useReviewSessionStore.getState()

afterEach(() => actions.reset())

describe('useReviewSessionStore', () => {
  it('starts in the idle phase', () => {
    expect(useReviewSessionStore.getState().phase).toBe('idle')
  })

  it('transitions idle → active on startSession', () => {
    actions.startSession([])
    expect(useReviewSessionStore.getState().phase).toBe('active')
  })
})
```

---

## 5. End-to-End Tests

### 5.1 Stack

Playwright (`@playwright/test`) targeting Chromium for the first wave. Config lives at `apps/web/playwright.config.ts`. Specs live in `apps/web/e2e/`.

### 5.2 Selector preference

Use accessible-name selectors so the test asserts on what a screen-reader user actually hears:

1. `getByRole('button', { name: /save/i })`
2. `getByLabel('Email')`
3. `getByText('Welcome back')`
4. `data-testid` only when 1–3 are unstable or ambiguous

### 5.3 Determinism rules

- Anchor on UI conditions (URL change, element visible, request resolved), never `waitForTimeout`. Playwright's `expect(...).toHaveURL(...)` and `.toBeVisible()` auto-retry.
- Pin viewport, locale, and timezone in `playwright.config.ts` so `buildDashboardCalendarContext` produces a stable "today" key.
- Disable retries on specs that mutate FSRS state (the review-session E2E in particular) — a half-passed run leaves seeded cards in an advanced state.
- Seed test users via the API service layer (not raw SQL) so writes go through `fsrs.service.ts` and approved RPCs. Never mutate premade source cards (`user_id IS NULL`).

### 5.4 What belongs here

- Smoke: app boots, anonymous reaches `/`
- Middleware gating: redirect contracts for protected routes
- Auth: login + logout against a seeded Supabase user
- The primary product flow: open due deck → start session → rate → summary

### 5.5 What does NOT belong here

- Per-component behavior (use the component tier)
- AI-backed card generation (OpenAI dependency — mock at component tier instead)
- Every page or every form (the cost-benefit drops sharply past the four flows above)

---

## 6. Running Tests

```bash
# Everything (all workspaces, all tiers except E2E)
bun test

# API only
bun --filter @fsrs-japanese/api test                # unit + integration
bun --filter @fsrs-japanese/api test src            # unit only
bun --filter @fsrs-japanese/api test tests/integration

# Web only
bun --filter @fsrs-japanese/web test                # Vitest, one-shot
bun --filter @fsrs-japanese/web test:watch          # Vitest, watch mode
bun --filter @fsrs-japanese/web test:coverage       # Vitest + V8 coverage
bun --filter @fsrs-japanese/web test:e2e            # Playwright
bun --filter @fsrs-japanese/web test:e2e:ui         # Playwright UI mode

# Frontend verification (still useful as fast pre-commit gates)
bun run --filter @fsrs-japanese/web typecheck
bun run --filter @fsrs-japanese/web lint
bun run --filter @fsrs-japanese/web build
```

First-time Playwright setup requires the Chromium binary:

```bash
bunx --filter @fsrs-japanese/web playwright install --with-deps chromium
```

---

## 7. Mocking Guidelines

### API (Express, `bun:test`)

| Dependency | How to mock |
|---|---|
| Supabase client | `mock.module('../../db/supabase.ts', ...)` — register before dynamic `import()` |
| Redis client | `mock.module('../../db/redis.ts', ...)` — same pattern |
| OpenAI client | `mock.module('openai', ...)` |
| Express `req`/`res` | Construct plain objects; use `supertest` for full middleware chains |

### Frontend (React / Next.js, Vitest)

| Dependency | How to mock |
|---|---|
| API calls | MSW handlers in `apps/web/test/msw/handlers.ts`; per-test overrides via `server.use(http.get(...))`. Mock at the `fetch` boundary, **never** inside TanStack Query hooks. |
| Zustand stores | Reset state in `afterEach` by calling the store's `actions.reset()`. The action references are stable across resets. |
| Next.js navigation | `vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, ... }), usePathname: () => '/', ... }))`. A default mock lives in `apps/web/test/setup.ts`; override per test via `vi.mocked(useRouter).mockReturnValue(...)`. |
| `next/image`, `next/font` | Pre-mocked in `setup.ts` as passthrough stubs. |
| Browser APIs missing in jsdom | `matchMedia`, `IntersectionObserver`, `ResizeObserver` are shimmed in `setup.ts` so reduced-motion code paths short-circuit cleanly. |

### Rules

- Mock external services (Supabase, Redis, OpenAI) in unit tests — never call them for real.
- Do not mock internal modules (services, utils) in unit tests — if you feel the urge, split the function instead.
- Do not mock the module under test itself.
- Use `mock.restore()` (bun:test) or `vi.restoreAllMocks()` (Vitest) in `afterEach` when a mock changes observable global state.
- MSW's `onUnhandledRequest: 'error'` is intentional — it surfaces missing handlers loudly during authoring instead of silently letting requests fall through.

---

## 8. What Not to Test

- **Implementation details:** test inputs and outputs, not which internal methods were called.
- **Third-party library internals:** trust that `ts-fsrs`, Zod, and Supabase work correctly.
- **Type correctness:** TypeScript catches type errors at compile time; do not write tests that only assert types.
- **Trivial getters/setters:** a function that returns `this.value` does not need a test.
- **The FSRS algorithm math:** `ts-fsrs` owns the scheduler math; test that `processReview` persists the result correctly, not that the scheduling math is right.
- **Class names or inline styles:** assert against semantic queries (`getByRole`, `toHaveAccessibleName`) rather than Tailwind output.
- **Server Components rendering:** RTL + jsdom cannot render `async function Page()`; cover those via Playwright or by testing the `*Client` child.

---

*End of Testing Strategy*
