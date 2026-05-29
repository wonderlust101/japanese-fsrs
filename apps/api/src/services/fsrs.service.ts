// FSRS service — split into focused modules under ./fsrs/ during the 2026-05
// maintainability pass (audit M3). This file is the stable public surface:
// every caller imports from "../services/fsrs.service.ts", and these re-exports
// keep that path working. FSRS state may still only be written through these
// functions (the "FSRS state … only through fsrs.service.ts" rule in CLAUDE.md
// holds — the writers all live in ./fsrs/{process,rollback,reschedule}.ts).
// The shared scheduler + helpers live in ./fsrs/shared.ts.

export { getRetrievability, previewCardRatings, previewNextStates } from "./fsrs/preview.ts";
export { processReview, processReviewBatch } from "./fsrs/process.ts";
export { rescheduleFromHistory } from "./fsrs/reschedule.ts";
export { forgetCard, rollbackReview } from "./fsrs/rollback.ts";
export type { FsrsInitialState, ProcessReviewResult, RatingPreview } from "./fsrs/shared.ts";
export { getInitialFsrsState } from "./fsrs/shared.ts";
