1. Surfaces that look complete but aren't wired to live data

/cards (the cross-deck cards browser) — runs entirely on fixtures

apps/web/app/(app)/cards/_components/cards-browser-view.tsx
- filteredRows is sourced from devState.rows (a dev panel), never from the backend (lines 71–113).
- No call to GET /api/v1/cards/ even though the backend exists and the route is mounted.
- qualityIssues is useMemo(() => [], []) — never populated (line 51).
- Every row action (edit, add-copy, move, delete) is a showToast('…coming') (lines 119–134).
- handleSavedView, handleMoreFilters are toast-only.
- CardsBulkBar component exists but isn't mounted on the page.

/today weak-spots module — missing

apps/web/app/(app)/today/_components/today-client.tsx
- The IA wireframe calls for a weak-spots/practice-signal card on Today; the page renders only Hero + WeekRhythmStrip + ExitLinksRow.
- Backend signal (GET /api/v1/weak-spots?status=unresolved) is live and already consumed by the sidebar badge — Today never reads it.

Onboarding decks step — selections are thrown away

apps/web/app/onboarding/decks/page.tsx:176-196
- User toggles subscribedIds, the handler calls updateProfileAction(...) but never calls copyPremadeDeckAction for any selected deck.
- The selected deck IDs are discarded on continue.

/insights/progress & /insights/statistics — partially wired

- Progress: desiredRetention is hardcoded 0.9 (ProgressView.tsx:239), not pulled from profile.retentionTarget. cardsAddedThisMonth: 0
  hardcoded (line 146).
- Statistics: documented gaps in adapt-live.ts — answerButtons, intervals, FSRS stability/difficulty histograms, and optimizationStatus
  always render "no[ data yet" because the backend has no endpoint for them. SECONDS_PER_REVIEW = 18 is a heuristic; real per-review duration
  isn't tracked.]()

Cards quality strip — enum mismatch + no caller

apps/web/app/(app)/cards/_components/cards-quality-bars.tsx
- Frontend enum: missing-audio | missing-sentence | missing-kanji-breakdown | missing-mnemonic | missing-nuance.
- Backend enum (/insights/card-quality): missing_reading | missing_meaning | missing_example | missing_mnemonic | missing_picture |
  missing_nuance.
- And nothing hits the endpoint anyway — qualityIssues is hardcoded [].

2. Routes referenced from the UI that don't exist (will 404)

┌─────────────────────────────────────────────────────────┬─────────────────────────────────────────────┐
│                         Source                          │                 Broken link                 │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ cards/[cardId]/_components/card-detail-view.tsx:98      │ /cards/${cardId}/edit (Edit action)         │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ cards/[cardId]/_components/card-detail-view.tsx:149,195 │ /review/repair/${cardId} (Repair link)      │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ review/summary/page.tsx:174,177                         │ /review/repair, /review/repair?cards=…      │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ (auth)/login/page.tsx:140                               │ /forgot-password                            │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ (auth)/signup/page.tsx:296                              │ /help                                       │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ _components/user-menu.tsx:134                           │ /report-bug                                 │
├─────────────────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ (no surface)                                            │ /privacy, /terms (Kanban tracks as missing) │
└─────────────────────────────────────────────────────────┴─────────────────────────────────────────────┘

Note: /cards/[cardId]/repair/page.tsx exists but is still a StubPage.

3. Stub UI handlers waiting for backend or wiring

/cards/[cardId] detail (card-detail-view.tsx)
- Suspend / Unsuspend dialog confirm = showToast('Suspend is coming. The endpoint is pending.') (lines 274–277). is_suspended exists on the
  schema and service but no PATCH/POST endpoint toggles it.
- Move card dialog confirm = showToast('Card move is coming...') (line 294). Even doesn't call the (stub) moveCardAction.

/decks/[id] detail (deck-detail-view.tsx)
- Add a copy variant of MoveCardDialog = showToast('Adding a copy to another deck is coming...') (lines 511–514).
- Move card here does call moveCardAction, but…

moveCardAction in lib/actions/cards.actions.ts:169
- POSTs to /api/v1/cards/:id/move which does not exist on the backend. Comment confirms it: "Until the endpoint exists in production, calls
  will surface as an API error."

/add/review (AI card review)
- Image generation — imageDataUrl is captured in the draft store but never passed to saveCardAction (no upload endpoint).
- "Regenerate mnemonic" / "Regenerate sentence" call the heavy generateCardPreviewAction instead of the dedicated generateMnemonicAction /
  generateSentencesAction because no cardId exists pre-save (generated-review-client.tsx:254, 268). Tracked as "needs a saved card id".
- Sentence audio playback — onPlaySentenceAudio is a no-op-toast stub (example-sentences.tsx:23); audio URLs aren't on the wire.

/review/session — Undo is local-only (cancels a deferred submission). No call to POST /reviews/:reviewLogId/rollback from anywhere. If you
intend a true historical rollback UI, it's missing.

Deck archive (useArchiveSet in use-deck-prefs.ts:197) — localStorage-only, no backend persistence; archive state won't sync across devices.

Review summary personal-best — localStorage placeholder per docs/status/FRONTEND.md.

4. Backend endpoints with no frontend caller

These shipped on your backend audit but no UI reaches them yet:

- POST /api/v1/auth/login — frontend calls Supabase server SDK directly in loginAction (auth.actions.ts:13).
- POST /api/v1/auth/refresh — no caller.
- POST /api/v1/auth/logout — frontend calls supabase.auth.signOut() directly.
- GET /api/v1/cards/ (cross-deck list) — /cards page never calls it (see §1).
- POST /api/v1/cards/:id/forget — no UI surface.
- POST /api/v1/cards/:id/reschedule — no UI surface.
- POST /api/v1/cards/:id/regenerate-embedding — no UI surface.
- POST /api/v1/reviews/:reviewLogId/rollback — no caller.
- GET /api/v1/insights/card-quality — enum mismatch + no caller (see §1).

5. Frontend N+1 patterns that should now collapse

Backend listDecks returns dueCount, newCount, matureCount, dueNewCount, dueReviewCount, lastReviewedAt per row (Stage 3). Frontend still fans
out:
- apps/web/app/(app)/decks/_components/deck-list.tsx:73-78 — useQueries over getDeckAction(deck.id) for every deck.
- apps/web/app/(app)/insights/forecast/_components/DeckContributorsCard.tsx:61-66 — same pattern, only consumed for dueCount.

Both can drop the fanout and read the rollups straight from the list.

6. Smaller items

- Settings IA missing sections — apps/web/app/(app)/settings/ has only profile/, learning/, security/. Display, Data & sync, Review behavior
  haven't shipped (FRONTEND.md confirms).
- Email + display-name updates bypass the API — profile-section.tsx:137,152 calls supabase.auth.updateUser from the client. Consistent with
  the project's "auth client-side only" rule but worth flagging.
- /onboarding/recommendations stale TODO still in onboarding/decks page comment area.
- Forecast per-deck filter & retention timeline chart — deferred per FRONTEND.md.

  ---
Recommended priority order

1. /cards browser — biggest disconnect (whole page is fixtures); single biggest win.
2. Onboarding decks copy step — silently dropping user choices is bad UX.
3. Move/Suspend/Add-copy/Edit on card detail + deck detail — many entry points, all dead.
4. Broken routes (/review/repair, /cards/:id/edit, /forgot-password, /help, /report-bug) — pick a stub-vs-implement strategy per route.
5. Today weak-spots module — backend signal is ready, only the surface is missing.
6. N+1 cleanup in /decks and DeckContributorsCard.
7. Wire card-quality — backend shipped, no UI consumer.
8. Decide on auth/login, auth/refresh, auth/logout backend endpoints — either point the frontend at them or remove as dead code.