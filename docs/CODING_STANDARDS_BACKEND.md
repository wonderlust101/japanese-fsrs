# Backend Coding Standards

This file defines standards for backend / server-side code in this monorepo. It complements [CODING_STANDARDS.md](CODING_STANDARDS.md), which must be read first for cross-cutting principles (working style, types, tests, monorepo hygiene, documentation, workflow). This file covers concerns specific to server-side work: the data layer, API design, security, and resilience.

The conventions here are not preferences — they're requirements. If a change you're considering would violate one of these, stop and surface it for human review rather than silently working around it.

---

## Data layer

- **Every schema change has a forward migration.** Follow [DATABASE.md](DATABASE.md) for exact Supabase/Postgres migration rules.
- **Production-safe migrations.** Avoid operations that hold long locks on large tables. Use the safe patterns in [DATABASE.md](DATABASE.md) for indexes, populated-table constraints, backfills, and destructive changes.
- **Index new query patterns.** Every WHERE, ORDER BY, and JOIN on a non-trivial query needs an index. Verify by running the database's query plan tool (`EXPLAIN`, query analyzer, etc.) — don't assume.
- **Foreign key columns are usually NOT auto-indexed.** Postgres in particular: add an index on the referencing side of every FK that gets queried.
- **No N+1 queries.** Anything looping over results and querying inside the loop gets eager-loaded, batched (`IN (...)`, `WHERE id = ANY(...)`), or memoized per-request (DataLoader pattern).
- **Atomic multi-step writes.** Multi-write operations that must be atomic are wrapped in a transaction. Never wrap a transaction around external API calls or queue publishes — use the outbox pattern.
- **Nullability matches reality.** Non-null only on fields that are always present. State-transition timestamps (`verified_at`, `archived_at`, `deleted_at`) are nullable.
- **Cascade behavior is intentional.** Choose cascade / restrict / set-null deliberately per FK. Don't default to cascade on relationships where data should be retained (orders, audit logs, financial records).
- **Soft deletes are consistent.** If a table uses a deleted-at column, every read filters it out. Unique constraints on soft-deleted tables need partial indexes (e.g., `WHERE deleted_at IS NULL`).
- **No `SELECT *` over HTTP boundaries.** Select only the columns you need. Especially: never return password hashes, tokens, internal flags, or audit fields.

---

## API design

- **Match the codebase's API conventions.** Status codes, error envelope shape, naming (camelCase over HTTP, snake_case in SQL), date format (ISO 8601 with timezone), and numeric precision rules. Follow the dominant pattern.
- **Method semantics.** Read methods are read-only — no state mutation, ever. Idempotent methods are actually idempotent (second call doesn't fail or change state). Don't use POST for fetching unless the query string would be impractically large.
- **Status codes used correctly.** Distinguish:
  - 400 (malformed) vs 422 (well-formed but invalid) — pick one and apply consistently.
  - 401 (not authenticated) vs 403 (authenticated but not authorized).
  - 404 (not found) vs 409 (conflict) vs 410 (gone).
  - Don't return 200 with `{ success: false }` on errors.
- **Validate every public endpoint.** Body, query, params, headers — all validated at the boundary, before any work. No reading from request input without a schema run first.
- **Coerce string-typed input.** Query strings and path params arrive as strings. Numbers, booleans, dates, and enums must be coerced and validated before use.
- **Pagination, filtering, sorting are consistent.** Pick one pagination scheme (cursor for large tables, offset for small/admin) and one parameter convention. Sortable and filterable fields are allow-listed per endpoint — never accept arbitrary column names.
- **Bound page size.** Every paginated endpoint has a max page size. Never accept arbitrary limit values.
- **Idempotency keys on critical mutations.** Review submissions, card/deck mutations, premade subscriptions, embedding regeneration, and any other mutation with business consequence on duplicate execution accept and honor an idempotency key (`Idempotency-Key` header is the convention).
- **Webhook receivers verify signatures BEFORE parsing the payload.** Any webhook receiver verifies signatures before parsing and dedupes on event ID to handle redelivery.
- **Versioning is explicit.** New API versions follow the codebase's scheme (URL prefix, header, content-type negotiation). Breaking changes go in a new version.
- **Logs at decision points, not everywhere.** Request entry/exit, errors, business events. Never log passwords, tokens, full request bodies from sensitive endpoints, or full error payloads from third-party SDKs (they often echo the request, including secrets).

---

## Security and authorization

- **Auth by default.** Every route requires authentication unless explicitly marked public. The opt-out is visible and intentional.
- **Authorization, not just authentication.** Authenticated does not mean authorized. Verify the user has rights to *this specific resource*.
- **Ownership checks live in the WHERE clause.** Scope queries by the authenticated user and resource relationship in the WHERE clause itself, not as a post-fetch check. The row should never have been fetched if the user has no right to it.
- **User/resource scoping in every query.** User-scoped models filter by the authenticated user or rely on documented RLS. There is no "I'll add the ownership filter later."
- **No mass assignment.** Never spread request input into a model or pass it directly to an update call. Use a DTO or strict schema with explicit allowed fields. Never accept identifiers (`id`, `userId`, resource owner IDs), role/permission fields, verification flags, or audit fields from the client.
- **Sanitize errors.** Production responses don't include stack traces, ORM errors, database constraint messages, or third-party SDK errors. Generic message + correlation ID for unexpected errors. Specific actionable message for known operational errors.
- **Secrets in environment / secret manager only.** No hardcoded credentials, API keys, or signing secrets. Validate environment configuration at startup with a schema. Secrets are never logged, never returned in errors, never reach client bundles.
- **Strong randomness for security.** Use cryptographically secure random sources (e.g., `crypto.randomBytes`, `secrets` module in Python, `crypto/rand` in Go). Never use general-purpose random (`Math.random`, `random.random`) for tokens, IDs, or anything security-relevant.
- **Strong password hashing.** bcrypt, scrypt, or argon2id — never plain hashing (SHA-256, MD5) even with a salt. Constant-time comparison for password and HMAC verification.
- **Authenticated encryption.** AES-GCM, ChaCha20-Poly1305, or equivalent. Never AES-CBC without HMAC.
- **Input validation against injection surfaces.** Use parameterized queries — never string-interpolate user input into SQL, shell commands, file paths, or other interpreted contexts. Allow-list URL schemes for outbound fetches and block private IP ranges to prevent SSRF.
- **CORS, CSRF, cookies configured intentionally.** Auth cookies are HttpOnly, Secure, SameSite. CSRF protection on cookie-auth state-changing endpoints. CORS allow-list explicit, no origin reflection with credentials.
- **Rate limit auth-adjacent endpoints.** Login, signup, password reset, MFA verify — limited per IP AND per identifier (account). Login rate-limited per IP only is a credential-stuffing risk.

---

## Error handling and resilience

- **Every async operation has a defined failure path.** Either awaited inside a try/catch (or equivalent), explicitly handled, or propagates to a known boundary handler.
- **No floating async work.** Promise-returning calls are awaited or explicitly handled. Fire-and-forget is explicit (a wrapper that logs failures), not accidental.
- **No empty catches.** Swallowing errors silently hides real bugs. Either handle, log + rethrow, or don't catch.
- **Preserve error context.** Wrap-and-rethrow with a `cause` reference (e.g., `cause` option in JS Error, `from` in Python, error wrapping in Go). Don't drop the original.
- **Every external call has a timeout.** HTTP clients, SDK clients, and database queries all have explicit timeouts. Default-no-timeout (a common default in HTTP clients) is unacceptable.
- **Database statement timeouts configured.** At the connection or pool level, plus per-query for known-expensive operations.
- **Retry only what's idempotent.** Don't retry validation errors, 4xx client errors, or non-idempotent mutations without an idempotency key. Use exponential backoff with jitter and bounded max attempts.
- **Circuit breakers on flaky downstreams.** When a dependency is down, retrying every request makes it worse. Use a circuit breaker on critical external calls.
- **Graceful degradation on non-critical dependencies.** Analytics, telemetry, caches, recommendation services — failures don't break the request. Required dependencies surface their failure as service unavailability.
- **Background jobs are idempotent.** Background job and queue handlers are safe to run twice — use conflict-handling inserts, dedup by job ID, or storage-backed idempotency keys.
- **Background job retry policies.** Background jobs and queues use exponential backoff with jitter, bounded max attempts, dead-letter handling for permanent failures, and alerting on stuck failure queues.
- **Graceful shutdown.** Service handles SIGTERM by stopping new work, draining in-flight, and closing connections — within a bounded grace period.

---

## Test patterns specific to the backend

(See [CODING_STANDARDS.md](CODING_STANDARDS.md) for general test principles.)

- **API endpoints are integration-tested.** Test through the framework — request → handler → response — including auth, validation, and error responses. Don't unit-test handlers by calling them directly; that skips middleware.
- **Database tests use a real (test) database.** Heavy ORM mocking lies about behavior. Test against a transactional or per-test-isolated database.
- **Authorization tests for every endpoint.** Allowed user, disallowed user, no user, and cross-user resource attempts (IDOR tests). Skip even one and bugs go to production.
- **Failure paths tested.** Every error condition the endpoint can return. Every external service failure (timeout, 5xx, malformed response). Every retry boundary.
- **Migrations tested.** Forward migrations are exercised where practical; backfill scripts have a dry-run; long migrations are tested on representative data volume.

---

## Performance specific to the backend

(See [CODING_STANDARDS.md](CODING_STANDARDS.md) for general performance principles.)

- **EXPLAIN new non-trivial queries.** Verify index usage. Watch for sequential scans on large tables, leading-wildcard LIKE, JSON queries without supporting indexes.
- **Parallelize independent calls.** When a request needs data from multiple sources that don't depend on each other, fan out concurrently — not serially.
- **Cache reference data with explicit invalidation.** Per-request memoization for query deduplication; cross-request caching for hot reference data with a clear invalidation strategy on writes.
- **Slow operations off the request path.** Long-running external calls, generation jobs, bulk writes, and file processing run asynchronously instead of blocking the request.
- **Cache keys include every dimension that affects the result.** User, locale, feature flag values, version, deck/card scope, and any other result-changing dimension. Missing dimensions cause cross-bucket leakage.
- **HTTP cache headers set deliberately.** Static assets cached aggressively with content-hashed filenames. User-specific responses are private and not shared. Public reads can use stale-while-revalidate where appropriate.
