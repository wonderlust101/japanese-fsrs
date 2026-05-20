# Spec: `/add/review` post-save iteration UI

## 1. Overview

The `/add/review` capture flow already wires a cheap regeneration branch — `generateSentencesAction(savedCardId, …)` and `generateMnemonicAction(savedCardId)` — at `apps/web/app/(app)/add/review/_components/generated-review-client.tsx:268`. That branch is currently unreachable because `SuccessBlock` short-circuits the entire form once `saved !== null` (line 356). This spec makes the cheap branch reachable through a non-destructive "tweak this card" affordance on the success screen, which re-enters the same component in an `editing-saved` mode that PATCHes back to the saved card.

### User value
- Users who notice a wrong nuance, awkward sentence, or weak mnemonic immediately after save no longer have to leave the flow and edit from `/cards/[id]`.
- The dedicated AI endpoints (~80% cheaper than full card regeneration) are exercised in the path they were built for.
- Keeps the celebratory `SuccessBlock` as the default terminal state — quiet by default, more powerful for users who want it.

### Out of scope
- Changing the `SuccessBlock` copy or "Add another / Return to Today" defaults.
- A standalone post-save UI on `/cards/[id]`. The card detail page already has its own edit affordances.
- Bulk capture or batch tweaking.

---

## 2. Functional requirements (EARS)

**FR-1.** When the user successfully saves a card from `/add/review`, the system shall capture the returned card's `id` **and** `version` so subsequent PATCH calls can satisfy `If-Match`.

**FR-2.** Where the saved state is shown, the system shall render a third action labelled "Tweak this card" alongside the existing "Add another" and "Return to Today" buttons.

**FR-3.** When the user activates "Tweak this card", the system shall transition the page from `saved` mode to `editing-saved` mode without unmounting the component, restoring the editable form and preview with the saved card's current field values.

**FR-4.** Where the page is in `editing-saved` mode, the system shall:
- replace the primary action label from "Save card" with "Update card",
- replace the "Ready to save." status with a quiet "Editing saved card." status,
- keep the AI-regen affordances ("Try another sentence", "Try another mnemonic") active and routed through the cheap dedicated endpoints (because `savedCardId !== null`),
- continue to surface field-level validation blockers identically to creation mode.

**FR-5.** When the user submits an update in `editing-saved` mode and the deck selector value differs from the deck the card currently lives in, the system shall first call `moveCardAction(cardId, newDeckId)` and, on success, then call `updateCardAction(cardId, version, payload)` for the remaining content diff.

**FR-6.** When the user submits an update in `editing-saved` mode and the deck has not changed, the system shall call `updateCardAction(cardId, version, payload)` only.

**FR-7.** When `updateCardAction` succeeds, the system shall replace the locally stored `version` with the `version` returned in the PATCH response, so the next tweak in the same session can PATCH again without refetching.

**FR-8.** When an update succeeds, the system shall display a quiet inline "Updated." status line near the primary action — replacing the editing status — and keep the form in `editing-saved` mode so the user can keep iterating.

**FR-9.** When `updateCardAction` returns a 412 `If-Match` conflict, the system shall:
- show a conflict message ("Someone else updated this card. Reloading the latest version — your unsaved edits will be lost."),
- refetch the card via `getCardByIdAction(cardId)`,
- replace local `fields`, `deckId`, and `version` with the refetched card's values,
- return the user to `editing-saved` mode (no automatic retry).

**FR-10.** When `updateCardAction` fails for any non-412 reason, the system shall surface the error inline in the existing `saveError` slot and leave local state untouched so the user can retry.

**FR-11.** When the user clicks "Return to Today", "Add another", or navigates away, the system shall not preserve `editing-saved` state across navigations. The capture draft store has already been reset at save time (line 334) and remains reset.

**FR-12.** Where `editing-saved` mode is active and the user reloads the page or otherwise loses the in-memory state, the system shall not attempt to restore the mode. The user is treated as a fresh visitor to `/add` (matching FR-11).

---

## 3. Non-functional requirements

| Category | Requirement |
|---|---|
| Performance | The mode transition `saved → editing-saved` must not cause a network call. All field values needed to seed the form are already in component state. |
| Cost | Post-save regen MUST use `generateSentencesAction(savedCardId, …)` / `generateMnemonicAction(savedCardId)` (cheap endpoints), not `generateCardPreviewAction`. The existing branching at lines 277/300 already does this correctly when `savedCardId !== null`. |
| Accessibility | The mode transition must move focus to a stable landmark (Page header or the first editable field) and announce the mode change via the existing `role="status"` line. |
| Cmd/Ctrl+Enter shortcut | The existing shortcut (line 342) must continue to fire whichever action is currently primary — "Save card" in creation mode, "Update card" in `editing-saved` mode. |
| Optimistic concurrency | All PATCH calls MUST send `If-Match: <version>`. No "force-update" path is added. |
| Logging | No new client-side telemetry beyond existing patterns. |

---

## 4. Acceptance criteria (Given/When/Then)

**AC-1. Save captures version**
Given a user is on `/add/review` with a valid card draft,
When they click "Save card" and the save succeeds,
Then the local state holds both `savedCardId` and `savedVersion` from the API response, and the `SuccessBlock` is shown.

**AC-2. Tweak this card enters edit mode**
Given the `SuccessBlock` is showing for a freshly saved card,
When the user clicks "Tweak this card",
Then the form re-mounts visually with the saved field values pre-filled, the primary button reads "Update card", and the status line reads "Editing saved card."

**AC-3. Cheap regen is reached**
Given the user is in `editing-saved` mode,
When they click "Try another sentence",
Then `generateSentencesAction(savedCardId, 1)` is called (not `generateCardPreviewAction`), and the returned sentence replaces `sentenceJa`/`sentenceEn`/`sentenceFuri`.

**AC-4. Content-only update**
Given the user is in `editing-saved` mode and the deck has not changed,
When they edit a field and click "Update card",
Then `updateCardAction(cardId, version, payload)` is called with `If-Match: <version>`, the response's new `version` replaces local `savedVersion`, the status reads "Updated.", and the form stays in `editing-saved` mode.

**AC-5. Deck move during update**
Given the user is in `editing-saved` mode and selects a different deck,
When they click "Update card",
Then `moveCardAction(cardId, newDeckId)` is called first; on success, `updateCardAction(cardId, version, contentPayload)` is called with the version returned by the move call.

**AC-6. Conflict recovery**
Given the user is in `editing-saved` mode and the card's server version has advanced (e.g., another tab edited it),
When they click "Update card",
Then a 412 is returned, a conflict message is shown, `getCardByIdAction(cardId)` reloads the card, the form is reseeded with server values, and the user remains in `editing-saved` mode (local edits discarded).

**AC-7. Tweak loop with same shortcut**
Given the user is in `editing-saved` mode,
When they press Cmd/Ctrl+Enter,
Then "Update card" fires (not "Save card"), and the same validation/blocker rules apply.

**AC-8. Capture draft remains cleared**
Given a user updates a card and then clicks "Add another",
When they land on `/add`,
Then the capture draft is empty (no residue from the prior card).

---

## 5. Error handling

| Scenario | Behavior |
|---|---|
| 412 `If-Match` conflict on PATCH | Refetch via `getCardByIdAction`, reseed form, show "Someone else updated this card…" message, no retry. |
| Network / 5xx on PATCH | Surface error in `saveError` slot, keep local state, allow retry. |
| `moveCardAction` fails | Show error in `saveError` slot. Do not call `updateCardAction`. User stays in `editing-saved` mode with the new deck selection intact. |
| `moveCardAction` succeeds but `updateCardAction` then fails | Card is now in the new deck (already persisted). Show error and keep editing mode; on retry, only `updateCardAction` runs since `deckId` now matches the card's current deck. |
| `generateSentencesAction` / `generateMnemonicAction` fails | Existing behavior: set `aiError`, clear the per-regen loading flag, leave fields untouched. |
| Component remounts (browser refresh) while in `editing-saved` mode | Route guard at line 151 sends user back to `/add` because the draft store is empty. Acceptable per FR-12. |

---

## 6. Implementation TODO

### Frontend — `generated-review-client.tsx`
- [ ] Add `savedVersion: number | null` state alongside `savedCardId`.
- [ ] At line 332, capture `created.version` into `savedVersion` (already returned by `saveCardAction`).
- [ ] Add `mode: 'creating' | 'saved' | 'editing-saved'` state (or derive from `saved` + an `isEditingSaved` boolean — pick the clearer shape).
- [ ] Update the `if (saved !== null)` block to render the form when `mode === 'editing-saved'`. The existing form JSX can be reused unchanged.
- [ ] Add a third button to `SuccessBlock` ("Tweak this card") that flips `mode` to `editing-saved`. Keep "Add another" / "Return to Today" untouched.
- [ ] Replace the "Save card" label and the "Ready to save." status text conditionally on `mode === 'editing-saved'` (→ "Update card" / "Editing saved card.").
- [ ] In `onSave`, branch:
  - `mode === 'creating'` → existing path (unchanged).
  - `mode === 'editing-saved'` → build a content-only payload, conditionally call `moveCardAction` (if `deckId` differs from the card's current deck — needs to track `savedDeckId` separately), then call `updateCardAction`. Replace `savedVersion` with the PATCH response's `version`.
- [ ] Add an `updateStatus: 'idle' | 'updated'` state and render "Updated." in the SaveBlock status line when set. Clear it on the next field edit.
- [ ] Handle 412 specifically: detect from the error (need a typed error from `updateCardAction`), call `getCardByIdAction`, replace `fields` / `deckId` / `savedVersion`, surface conflict message, clear `updateStatus`.
- [ ] Add `savedDeckId: string | null` so deck-move detection works on every PATCH (not just the first).
- [ ] Audit the Cmd/Ctrl+Enter handler — it already invokes `onSave`; verify it still fires in `editing-saved` mode and respects blockers.

### Frontend — `cards.actions.ts`
- [ ] Change `updateCardAction` return type from `Promise<void>` to `Promise<ApiCard>`. Replace `voidResponseSchema` with `ApiCardSchema` and return the parsed card so callers can read the new `version`.
- [ ] Confirm `apiCall` surfaces 412s in a way the caller can detect (typed error code, status, or `name`). If not, add an `ApiConflictError` or a `status` field on the thrown error and update `apiCall` accordingly. **This is the one place where a small infrastructure tweak may be needed — verify before implementing.**

### Backend
- No changes expected. PATCH already returns the updated card with new `version`. `saveCardAction`'s endpoint already returns `ApiCard` (which includes `version`). `moveCardAction` already exists. Verify during implementation that no version drift exists between the move response and the subsequent PATCH (they should be sequential and `move` returns the updated card).

### Tests
- [ ] Component test: clicking "Tweak this card" transitions to `editing-saved` mode and re-renders the form with saved values.
- [ ] Component test: regen buttons in `editing-saved` mode call the cheap endpoints (`generateSentencesAction` with `cardId`, not `generateCardPreviewAction`). Mock `cards.actions` and assert.
- [ ] Component test: "Update card" with no deck change calls `updateCardAction` exactly once with the current `version`.
- [ ] Component test: "Update card" after changing decks calls `moveCardAction` then `updateCardAction`.
- [ ] Component test: a mocked 412 response triggers `getCardByIdAction` and shows the conflict message.
- [ ] Component test: after a successful PATCH, `savedVersion` is updated and a subsequent PATCH uses the new value.
- [ ] Action test: `updateCardAction` parses and returns `ApiCard` (regression for the return-type change).

### Docs / standards
- [ ] No `PRODUCT.md` / `DESIGN.md` edits expected — this is interaction polish on an existing screen, not a new product or visual primitive.
- [ ] If the SectionCard "Saved" block grows a third action permanently, note it in `docs/information_architecture/` under the `/add/review` wireframe.
- [ ] Update `docs/KANBAN_BOARD.md`: move the kanban item to In Progress / Done as the implementation proceeds.

---

## 7. Open questions to confirm in PR

1. Should "Updated." linger or auto-clear after N seconds? (Recommend: clear on next field edit, no timer — matches the rest of the form's quiet status pattern.)
2. Does the existing `apiCall` wrapper already expose 412 status to callers, or does it need a typed-error addition? Verify in `apps/web/lib/api/...`.
3. Should "Tweak this card" autoFocus or yield focus to the page header? Current `SuccessBlock` puts `autoFocus` on "Add another"; moving focus on mode change is the a11y-correct call.
