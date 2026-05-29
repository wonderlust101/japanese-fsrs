// Deck service — split into focused modules under ./deck/ during the 2026-05
// maintainability pass (audit M3). This file is the stable public surface:
// every controller imports from "../services/deck.service.ts", and these
// re-exports keep that path working. Internals (column projections, RPC
// envelope schemas, row mappers, the component logger) live in ./deck/shared.ts.

export { archiveDeck, unarchiveDeck } from "./deck/archive.ts";
export { assertCardDeckActive, assertDeckActive } from "./deck/asserts.ts";
export { copyDeck } from "./deck/copy.ts";
export { createDeck, deleteDeck, getDeck, listDecks, updateDeck } from "./deck/crud.ts";
