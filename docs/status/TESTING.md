# Testing Status

Refreshed by code inspection on 2026-05-17 (Frontend test suite row promoted from Unknown to Missing after a clean grep). See [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for the status legend and summary.

| Capability | Status | Evidence |
|---|---|---|
| API unit tests | Implemented | `apps/api/src/middleware/__tests__`, `apps/api/src/services/__tests__`, `apps/api/src/lib/__tests__`, `apps/api/src/__tests__` |
| API integration tests | Implemented | `apps/api/tests/integration/auth.routes.test.ts`, `cards.routes.test.ts`, `decks.routes.test.ts`, `health.routes.test.ts`, `insights.routes.test.ts`, `premade.routes.test.ts`, `profile.routes.test.ts`, `ratelimit.routes.test.ts`, `reviews.routes.test.ts`, `tomo.routes.test.ts` |
| Shared schema tests | Implemented | `packages/shared-types/src/schemas/__tests__/auth.schema.test.ts` |
| Frontend test suite | Missing | **Code-verified 2026-05-17:** `find apps/web -name '*.test.*' -o -name '*.spec.*'` (excluding `node_modules` / `.next`) returns zero files. `apps/web/package.json` has no `test` script. The kanban item "Frontend test coverage" remains open — runner selection (Vitest vs Bun's built-in) and the first wave of tests for the review / onboarding / premade-browse / insights flows are the next concrete pieces. The premade-browse tests will assert the new copy-model behavior (button text "Add to my library", `POST .../copy` issued on click, duplicate copies produce distinct decks, deletion of a copied deck uses the same path as any user-built deck). |
| Docs/link validation | Manual | Use `rg` checks and diff review after documentation edits. No automated docs checker was found. |
