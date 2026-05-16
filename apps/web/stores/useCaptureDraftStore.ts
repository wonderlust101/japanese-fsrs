import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ── Types ─────────────────────────────────────────────────────────────────────
//
// The Add Japanese page is a *capture surface* (see docs/information_architecture/
// 06_add_japanese.md). It does not call the create-card API itself — that work
// belongs to the downstream Generated Card Review page (`/add/review`), which is
// where the AI-generated card is shaped, the deck is suggested, and the persist
// call eventually fires.
//
// This store is the handoff: Add fills it; /add/review reads it.
//
// `imageDataUrl` is a client-only preview — we deliberately do not include the
// image in the create-card request body in this iteration (backend contract for
// image upload is deferred). The chip persists through Generated Card Review and
// Card Detail per the IA, so the preview survives the navigation.

export type CaptureCardType = 'comprehension' | 'production' | 'listening' | 'auto'

export interface CaptureDraft {
  word:         string
  sentence:     string
  /** Optional kana reading the user already knows. Empty string means "let
   *  Tomo infer." Surfaces on the back of the card (`WordStack`). */
  reading:      string
  /** Optional English meaning the user wants to lock in. Empty string means
   *  "let Tomo write one." Surfaces on the back of the card. */
  meaning:      string
  /** Optional personal mnemonic. Surfaces as a tab on the back of the card. */
  mnemonic:     string
  note:         string
  /** Required at capture per the v4 redesign (explicit IA deviation). Submit
   *  is gated on `deckId !== null`. */
  deckId:       string | null
  source:       string
  cardType:     CaptureCardType
  imageName:    string | null
  imageDataUrl: string | null
  /** Wall-clock ms when the draft was last touched; lets the next page warn
   *  about stale handoffs (e.g. browser back navigation hours later). */
  updatedAt:    number
}

export const EMPTY_CAPTURE_DRAFT: CaptureDraft = {
  word:         '',
  sentence:     '',
  reading:      '',
  meaning:      '',
  mnemonic:     '',
  note:         '',
  deckId:       null,
  source:       '',
  cardType:     'auto',
  imageName:    null,
  imageDataUrl: null,
  updatedAt:    0,
}

interface CaptureDraftActions {
  setDraft: (draft: CaptureDraft) => void
  reset:    () => void
}

interface CaptureDraftStore {
  draft:   CaptureDraft
  actions: CaptureDraftActions
}

export const useCaptureDraftStore = create<CaptureDraftStore>()(
  devtools(
    (set) => ({
      draft: EMPTY_CAPTURE_DRAFT,
      actions: {
        setDraft: (draft) => set({ draft: { ...draft, updatedAt: Date.now() } }),
        reset:    () => set({ draft: EMPTY_CAPTURE_DRAFT }),
      },
    }),
    { name: 'capture-draft-store' },
  ),
)

export const useCaptureDraftActions = (): CaptureDraftActions =>
  useCaptureDraftStore((s) => s.actions)
