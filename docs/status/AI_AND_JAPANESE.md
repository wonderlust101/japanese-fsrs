# AI And Japanese Content Status

Refreshed by read-only code inspection on 2026-05-10. See [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for the status legend and summary.

| Capability | Status | Evidence |
|---|---|---|
| AI card generation from a word | Implemented | `apps/api/src/routes/ai.ts`, `apps/api/src/services/ai.service.ts`, `packages/shared-types/src/schemas/ai.schema.ts` |
| AI example sentence generation | Implemented | `apps/api/src/routes/ai.ts`, `apps/api/src/services/ai.service.ts` |
| AI mnemonic generation | Implemented | `apps/api/src/routes/ai.ts`, `apps/api/src/services/ai.service.ts` |
| OpenAI response caching | Implemented | `apps/api/src/services/ai.service.ts`, `apps/api/src/db/redis.ts` |
| Prompt sanitization and structured output validation | Implemented | `apps/api/src/services/ai.service.ts`, `packages/shared-types/src/sanitize.ts`, `packages/shared-types/src/schemas/ai.schema.ts` |
| Tomo daily note insight/idiom API | Missing | `apps/web/app/(app)/dashboard/_components/dashboard-client.tsx` references `/api/v1/tomo/note`, paid insight content, and curated idioms; no `tomo` route, action, or API hook was found. |
| Embeddings for similar-card search | Implemented | `apps/api/src/services/card.service.ts`, `apps/api/scripts/backfill-premade-embeddings.ts` |
| Pitch accent, frequency rank, collocations, kanji breakdown fields | Partial | Shared field schemas allow these fields in `packages/shared-types/src/schemas/field-shapes.schema.ts`; older dedicated DB columns were removed in migrations and no specialized UI workflow was verified. |
| Sentence-layout card workflow | Partial | `layout_type = 'sentence'` exists in database/shared types, but comments in `packages/shared-types/src/field-shapes.ts` and `schemas/field-shapes.schema.ts` mark the sentence shape as reserved/open; no specialized create/render/review workflow was verified. |
| Morphological parsing tokens | Missing | Migration `20260502000004_align_card_schema.sql` added `cards.tokens` and `cards.parsed_at`, but migration `20260518000000_drift_and_dead_column_cleanup.sql` removed them. No current parser route, service, shared schema, or canonical database fields were found. |
