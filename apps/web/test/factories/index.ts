/**
 * Barrel for test fixture factories. Import factories from this module:
 *
 *   import { makeCard, makeDeck, makeProfile } from "@/test/factories";
 *
 * Resource-scoped modules stay accessible via deep import when a test only
 * needs one factory and the wildcard re-export is more noise than signal.
 */

export { makeCard, makeCardListItem, makeCrossDeckCardListItem, makeDueCard } from "./card";
export { makeDeck, makeDeckWithStats, makePremadeDeck } from "./deck";
export { makeRatingsPreview, makeReviewLog, makeSessionSummary, makeSubmitReviewInput } from "./review";
export { makeProfile } from "./user";
