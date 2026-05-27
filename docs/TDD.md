# Technical Design Companion

This document is a companion to the canonical schema reference in [DATABASE.md](DATABASE.md), the product strategy in [PRODUCT.md](PRODUCT.md), and the visual system in [DESIGN.md](DESIGN.md). It captures architecture and implementation boundaries. It must not duplicate table definitions, RPC signatures, or visual rules except as short summaries.

Current implementation summary lives in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), with detailed evidence under [status/](status/). Assistant-specific operational rules live in [../CLAUDE.md](../CLAUDE.md).

---

## Stack And Boundaries

| Layer | Current technology |
|---|---|
| Web | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Client state | Zustand 5 for review/session UI state |
| Server state | TanStack Query v5 |
| API | Express 5, TypeScript, Bun runtime |
| Database | Supabase PostgreSQL with pgvector |
| Cache/rate limits | Upstash Redis for production rate limits and AI/cache paths |
| AI | OpenAI via `OPENAI_CHAT_MODEL` and `OPENAI_EMBEDDING_MODEL` |
| SRS | `ts-fsrs` runtime scheduler |
| Shared contracts | `packages/shared-types` Zod schemas and TypeScript types |

The frontend never calls OpenAI or Supabase service-role APIs directly. Browser Supabase access is limited to auth session handling; application data flows through the Express API.

## Architecture

The repo is a Bun workspace with:

- `apps/web`: Next.js frontend, app shell, review experience, onboarding, decks, analytics, settings, and API clients.
- `apps/api`: Express REST API with routes -> controllers -> services. Controllers parse and respond; services own business logic and database access.
- `packages/shared-types`: shared wire types, enums, and Zod schemas.
- `supabase/migrations`: forward-only database migrations. [DATABASE.md](DATABASE.md) is the schema source of truth.

API route families are mounted under `/api/v1`: auth, profile, decks, premade decks, cards, reviews, analytics, AI, and health.

## Cross-Cutting Contracts

- Wire payloads are camelCase. Database columns and SQL RPC parameters are snake_case. Transforms happen in service-layer helpers.
- Retryable mutating POSTs use `Idempotency-Key`; exact storage and replay behavior lives in [DATABASE.md](DATABASE.md) and the route/controller implementation.
- `PATCH /cards/:id`, `PATCH /decks/:id`, and `PATCH /profile` use `If-Match: <version>` optimistic concurrency.
- Collection endpoints use one of two list contracts, per endpoint: **cursor** pagination returns `{ items, nextCursor, hasMore }` (decks, premade decks, cards-in-deck); **offset** pagination returns `{ items, hasMore, totalCount }` (the cross-deck cards browser and the weak-spots list, which need clickable numbered pages). The `offset` query param is bounded by a `.max()` cap as a deep-scan guard. The two shapes are not interchangeable — clients read the contract for the endpoint they call.
- Inherently bounded reads that are deliberately *not* paginated — due cards (capped by the daily limits), the 14-day forecast, and top-N similar cards — return a bare array rather than a list envelope.
- All protected routes use auth middleware. In production, they also use the default per-user rate limiter, with stricter production limiters layered onto costly AI, premade-copy, delete, batch, and analytics-dashboard paths. Development and test bypass rate-limit checks so local iteration and integration suites do not call Upstash for every guarded route.

## Database And Scheduling

Use [DATABASE.md](DATABASE.md) for exact enums, columns, constraints, indexes, triggers, RLS policies, and RPCs.

Key implementation rules:

- FSRS state writes go through `apps/api/src/services/fsrs.service.ts` and database RPCs.
- Review submission persists card state, review log, and weak spot detection atomically.
- Premade source cards have `user_id = NULL` and must not receive user review state.
- Users *copy* a premade deck into their library via `copy_premade_deck`, which creates a standalone user-owned deck plus personal card copies in one transaction. There is no ongoing subscription — refreshing content means deleting the deck and copying again, with the FSRS-progress cost surfaced explicitly. Source premade decks are hidden with `is_active = false` rather than hard-deleted, which only affects new copies; existing user copies are unaffected because they are independent rows.
- A single FSRS scheduler runs at `request_retention = 0.85`. The historic per-modality split (`comprehension` / `production` / `listening`) was removed in migration `20260614000000_drop_card_type.sql`; there is no `card_type` column.
- `layout_type` is the content shape (`vocabulary`, `grammar`, `sentence`) used by `fields_data` validation and rendering, and is the dimension behind `get_accuracy_by_layout_type`.
- `parent_card_id` links sibling cards for shared field propagation.

## Frontend Responsibilities

- Use App Router only.
- Use TanStack Query for server-derived data and Zustand for review/session-local state.
- Keep review interaction keyboard-first: reveal with space/enter and rate with 1-4.
- Keep offline review submissions in the offline queue and replay through the batch endpoint.
- Use the design tokens, component rules, and brand constraints in [DESIGN.md](DESIGN.md).
- Use semantic Japanese rendering: `lang="ja"` and the shared furigana component.

## AI Responsibilities

- Keep prompts and OpenAI calls in API services, not controllers or frontend components.
- Sanitize user-provided prompt inputs.
- Request structured JSON where applicable and validate returned payloads with shared Zod schemas.
- Cache successful AI results where the service layer already defines safe cache keys.
- Treat visible AI chrome as a product/design violation unless [PRODUCT.md](PRODUCT.md) explicitly allows the affordance.

## Testing

Testing strategy lives in [TESTING.md](TESTING.md). Implementation status summary lives in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), with current coverage evidence under [status/](status/).

At minimum, risky changes should include focused tests around the affected layer:

- Zod schemas and pure helpers for wire-contract changes.
- Service tests for business logic and database transform behavior.
- Integration tests for route/database behavior, idempotency, optimistic concurrency, auth, and production-gated rate limiting.
- UI tests or browser verification for user-facing workflow changes when available.

---

*Last updated: 2026-05-12*
