// Truly-identical types and constants shared between the two card-editor
// flows: the add-review editor (app/(app)/add/review) and the edit-card
// editor (app/(app)/cards/[cardId]/edit). Twin-specific types (KanjiEntry —
// the edit flow carries a `radical` field, CardFields — the edit flow carries
// `deckId`, the buildFieldsData / buildPreviewCard builders, etc.) stay
// per-flow in each twin's card-editor-fields.ts and aren't shared here.

// `id` is a client-only stable key for the editor lists — never persisted
// (each twin's buildFieldsData strips it). It pins row identity (focus / IME
// composition / accordion-open state) to the entry, not its index.
//
// `radical` is optional because only the edit flow round-trips it: the
// edit-card editor receives AI-generated cards whose kanji breakdown may
// carry a `radical` field, so the edit form preserves it through save (its
// `buildFieldsData` includes `radical` in the kanji-breakdown projection).
// The add-review form does NOT surface `radical` to the user and does not
// include it in its save payload — the field stays unset (or "") and is
// ignored on add's flow. Both flows wire the same KanjiEditor; the unified
// `add()` initializes `radical: ""` so the entry shape is consistent.
export interface KanjiEntry { id: string; kanji: string; meaning: string; reading: string; radical?: string }

// One authored example sentence. Mirrors `ExampleSentenceSchema`
// (packages/shared-types). A card holds an ordered list; the review back
// shows one per review (rotated stable-randomly), so list order is the
// author's browsing order, not a display priority.
export interface SentenceEntry { id: string; ja: string; en: string; furigana: string }

// Cap on authored example sentences. Keeps the editor bounded and storage
// sane; the rotation cycles through whatever is present.
export const MAX_SENTENCES = 10;

// How many sentences one "Generate examples" click fetches (clamped to the
// remaining headroom under MAX_SENTENCES).
export const SENTENCE_BATCH = 3;

// Stable per-row id for the editor list keys. A monotonic module counter is
// sufficient — keys only need to be unique and stable within a session — and
// avoids a crypto dependency. These ids are client-only and never persisted.
// The counter is shared across both flows (add and edit live on separate
// routes and aren't mounted simultaneously, so the global series is safe).
let rowKeySeq = 0;
export const nextRowKey = (): string => `row-${rowKeySeq++}`;
