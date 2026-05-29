# Testing Status

Refreshed by code inspection on 2026-05-29 (Frontend test suite promoted Missing → Implemented; the Vitest + Playwright + MSW stack landed in commit `d115742`). See [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for the status legend and summary.

| Capability | Status | Evidence |
|---|---|---|
| API unit tests | Implemented | `apps/api/src/middleware/__tests__`, `apps/api/src/services/__tests__`, `apps/api/src/lib/__tests__`, `apps/api/src/__tests__` |
| API integration tests | Implemented | `apps/api/tests/integration/auth.routes.test.ts`, `cards.routes.test.ts`, `decks.routes.test.ts`, `health.routes.test.ts`, `insights.routes.test.ts`, `premade.routes.test.ts`, `profile.routes.test.ts`, `ratelimit.routes.test.ts`, `reviews.routes.test.ts`, `tomo.routes.test.ts` |
| Shared schema tests | Implemented | `packages/shared-types/src/schemas/__tests__/auth.schema.test.ts` |
| Frontend test suite | Implemented | **Code-verified 2026-05-29:** 40 `*.test.*` files under `apps/web` (Vitest + jsdom + MSW; e.g. `stores/__tests__/useReviewSessionStore.test.ts`, `lib/actions/__tests__/cards.actions.test.ts`, `test/__tests__/axe.test.tsx`) plus 8 Playwright e2e specs. `apps/web/package.json` exposes `test` (`vitest run`), `test:coverage` (`vitest run --coverage`), and `test:e2e` (`playwright test`); per-directory coverage thresholds in `vitest.config.ts` gate the `web-test` CI job. Infra landed in commit `d115742`. |
| Docs/link validation | Manual | Use `rg` checks and diff review after documentation edits. No automated docs checker was found. |
