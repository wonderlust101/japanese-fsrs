# Testing Status

Refreshed by code inspection on 2026-05-13. See [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for the status legend and summary.

| Capability | Status | Evidence |
|---|---|---|
| API unit tests | Implemented | `apps/api/src/middleware/__tests__`, `apps/api/src/services/__tests__`, `apps/api/src/lib/__tests__`, `apps/api/src/__tests__` |
| API integration tests | Implemented | `apps/api/tests/integration/auth.routes.test.ts`, `cards.routes.test.ts`, `decks.routes.test.ts`, `health.routes.test.ts`, `profile.routes.test.ts`, `ratelimit.routes.test.ts`, `reviews.routes.test.ts` |
| Shared schema tests | Implemented | `packages/shared-types/src/schemas/__tests__/auth.schema.test.ts` |
| Frontend test suite | Unknown | `apps/web/package.json` has no explicit `test` script; static inspection did not find frontend test files. |
| Docs/link validation | Manual | Use `rg` checks and diff review after documentation edits. No automated docs checker was found. |
