// Card service — split into focused modules under ./card/ during the 2026-05
// maintainability pass (audit M3). This file is the stable public surface:
// controllers, scripts, and sibling services (e.g. review.service.ts imports
// DueCardRpcRowSchema + toApiDueCard) import from "../services/card.service.ts",
// and these re-exports keep that path working. Embedding helpers live in
// ./card.embeddings.ts; the rest is split across
// ./card/{shared,crud,cross-deck,mutations,bulk}.ts.

export {
	backfillPremadeEmbeddings,
	generateEmbedding,
	regenerateEmbedding,
} from "./card.embeddings.ts";
export * from "./card/bulk.ts";
export * from "./card/cross-deck.ts";
export * from "./card/crud.ts";
export * from "./card/mutations.ts";
export * from "./card/shared.ts";
