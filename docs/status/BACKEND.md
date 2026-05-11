# Backend And Data Status

Refreshed by read-only code inspection on 2026-05-10. See [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for the status legend and summary.

| Capability | Status | Evidence |
|---|---|---|
| Auth signup, cancel-signup, login, refresh, OTP verify/resend, logout | Implemented | `apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.service.ts`, `packages/shared-types/src/schemas/auth.schema.ts` |
| Password change and account deletion | Implemented | `apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.service.ts` |
| Profile get/update with study preferences and interests | Implemented | `apps/api/src/routes/profile.ts`, `apps/api/src/services/profile.service.ts`, `supabase/migrations/20260504000007_normalization_cleanup.sql`, `docs/DATABASE.md` |
| Optimistic concurrency for profile/deck/card PATCH | Implemented | `apps/api/src/controllers/profile.controller.ts`, `apps/api/src/controllers/decks.controller.ts`, `apps/api/src/controllers/cards.controller.ts`, `supabase/migrations/20260525000000_cards_version_column.sql`, `supabase/migrations/20260526000000_decks_profile_version_columns.sql` |
| User deck CRUD and stable pagination | Implemented | `apps/api/src/routes/decks.ts`, `apps/api/src/services/deck.service.ts`, `supabase/migrations/20260522000000_list_decks_and_premade_paginated.sql`, `supabase/migrations/20260523000000_list_pagination_cursor_hardening.sql` |
| Card CRUD, AI/manual creation, sibling shared-field sync | Implemented | `apps/api/src/routes/cards.ts`, `apps/api/src/services/card.service.ts`, `supabase/migrations/20260514000000_atomic_service_writes.sql`, `docs/DATABASE.md` |
| Semantic card similarity and embedding regeneration | Implemented | `apps/api/src/routes/cards.ts`, `apps/api/src/services/card.service.ts`, `apps/api/scripts/backfill-premade-embeddings.ts`, `supabase/migrations/20260502000006_find_similar_cards_rpc.sql`, `supabase/migrations/20260509000000_hnsw_partial_user_id.sql` |
| Premade deck browse, subscription, unsubscribe, self-healing subscribe | Implemented | `apps/api/src/routes/premade.ts`, `apps/api/src/services/premade.service.ts`, `supabase/migrations/20260504000003_subscribe_to_premade_deck_rpc.sql`, `supabase/migrations/20260521000000_subscribe_self_heal_and_orphan_cleanup.sql` |
| Full launch-size curated premade catalogue | Partial | Premade deck records and seed cards exist in `supabase/migrations/20260504000000_seed_premade_decks.sql`, but static inspection shows starter seed content, not the large catalogue described by older planning docs. |
| Premade deck update/merge workflow | Partial | `premade_decks.version` and `user_premade_subscriptions.last_seen_version` exist in `docs/DATABASE.md`; no merge/update route was found in `apps/api/src/routes/premade.ts`. |
| Onboarding deck recommendations API | Missing | `apps/web/app/onboarding/decks/page.tsx` references `/onboarding/recommendations`; no matching route family was found in `apps/api/src/routes/` or `apps/web/app/api/`. |
| FSRS review submit, batch submit, due queue, review forecast | Implemented | `apps/api/src/routes/reviews.ts`, `apps/api/src/services/fsrs.service.ts`, `apps/api/src/services/review.service.ts`, `supabase/migrations/20260515000000_batch_query_rpcs.sql`, `supabase/migrations/20260508000002_get_review_forecast_rpc.sql` |
| Review session summary including leeches | Implemented | `apps/api/src/routes/reviews.ts`, `apps/api/src/services/review.service.ts`, `supabase/migrations/20260516000000_pagination_and_session_summary_rpcs.sql`, `supabase/migrations/20260519000000_leech_cascade_and_premade_doc.sql` |
| Service-level rollback, forget, and reschedule from history | Implemented | `apps/api/src/services/fsrs.service.ts`, `supabase/migrations/20260502000001_review_logs_before_snapshot.sql`, `supabase/migrations/20260502000003_process_forget_rpc.sql` |
| Public API routes for rollback/forget/reschedule | Unknown | Service functions exist, but no matching route was found in `apps/api/src/routes/reviews.ts` or `apps/api/src/routes/cards.ts`. |
| Leech flagging | Implemented | `apps/api/src/services/fsrs.service.ts`, `supabase/migrations/20260514000000_atomic_service_writes.sql`, `docs/DATABASE.md` |
| Leeches list API and dashboard drill flag | Missing | `apps/web/app/(app)/dashboard/_components/dashboard-client.tsx` references a leeches-list API and `hasLeeches` flag; no matching route was found in `apps/api/src/routes/reviews.ts`. |
| AI leech diagnosis and prescription | Partial | `leeches.diagnosis` and `leeches.prescription` columns exist, but no AI diagnose route/service path was found. |
| Analytics heatmap, accuracy, streak, JLPT gap, milestones, bundled dashboard | Implemented | `apps/api/src/routes/analytics.ts`, `apps/api/src/services/analytics.service.ts`, `supabase/migrations/20260503000003_analytics_rpcs.sql`, `supabase/migrations/20260504000001_streak_jlpt_forecast_rpcs.sql` |
| Dashboard weekly and recent activity APIs | Missing | Dashboard comments reference weekly summary and recent-activity data (`/api/v1/analytics/week-summary` or `/api/v1/analytics/recent`); `apps/api/src/routes/analytics.ts` has no matching endpoints. |
| Dashboard deck stats API | Missing | Dashboard comments reference deck stats beyond `ApiDeckWithStats`; `apps/api/src/routes/decks.ts` only exposes the current deck CRUD/list/detail routes. |
| Paid/free tier entitlement model | Missing | Dashboard comments reference `user.tier`, and product docs require paid AI gating, but no profile/subscription entitlement field or server-side AI tier gate was found. |
| Idempotency for retryable mutating requests | Implemented | `apps/api/src/lib/idempotency.ts`, controller usage in decks/cards/reviews/premade, `supabase/migrations/20260524000000_idempotency_keys.sql` |
| Rate limiting with fail-open infrastructure behavior | Implemented | `apps/api/src/middleware/rateLimit.ts`, `apps/api/src/lib/circuit-breaker.ts` |
| Structured request logging and graceful shutdown | Implemented | `apps/api/src/middleware/requestLogger.ts`, `apps/api/src/lib/logger.ts`, `apps/api/src/lib/shutdown.ts`, `apps/api/src/routes/health.ts` |
