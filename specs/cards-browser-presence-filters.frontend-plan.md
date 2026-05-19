# Frontend Plan — Cards Browser Pitch / Image / Audio Filter Dimensions

Companion to [`cards-browser-presence-filters.spec.md`](./cards-browser-presence-filters.spec.md) and [`cards-browser-presence-filters.backend-plan.md`](./cards-browser-presence-filters.backend-plan.md).
Pinned to [`docs/CODING_STANDARDS.md`](../docs/CODING_STANDARDS.md) and [`docs/CODING_STANDARDS_FRONTEND.md`](../docs/CODING_STANDARDS_FRONTEND.md).

The backend slice is implemented (migration `20260624000000`, shared schema, service, controller, tests). This plan covers only the `apps/web` work needed to replace the toast stub at `cards-browser-view.tsx:336` with a real popover and wire the three new dimensions end-to-end.

---

## 0. Standards mapping

| Standard (source) | How this plan satisfies it |
|---|---|
| **Read before you write** (CODING_STANDARDS § Working principles) | Plan cites every touched file: `cards-browser-view.tsx:88` (URL read-once), `cards-filter-row.tsx:56` (CardsFilters origin), `saved-views-storage.ts:29` (recipe schema), `lib/actions/cards.actions.ts:196` (action options), `lib/api/cards.ts:48` (query hook), `lib/api/queryKeys.ts` (cache keys). No green-field design. |
| **Reuse before you reinvent** | Reuses `Pill` / `PillGroup` / `ToolbarChip` / `Toggle` / `Button` from `components/ui/`. Reuses the existing one-way URL-state pattern at `cards-browser-view.tsx:88-91`. No new design-system primitive. |
| **Match the codebase's conventions** | New popover follows the Warm Paper Raised + Soft Hairline + popover-lift shadow vocabulary already used by `TomoSelect.tsx:24-46`. Same `createPortal` + outside-click + Escape + focus trap pattern. |
| **No useEffect for data fetching** (CLAUDE.md / FRONTEND § Component framework correctness) | All server reads stay on TanStack Query (`useCardsCrossDeckQuery`). Effects are used only to (a) parse URL on mount and (b) reset selection/page when filters change — same shape as the existing code. |
| **Effects synchronize with external systems, not derive state** | Pattern-select disabled state is **derived during render** from `pitch === 'has'`, not via `useEffect`. Saved-view sync stays in the existing `useMemo`-based merge at `cards-browser-view.tsx:118`. |
| **Server state in a query library, query keys include every dimension** | `queryKeys.cards.crossDeck(opts)` already receives the whole options object — adding three keys to `CrossDeckCardsActionOptions` propagates automatically. No manual cache key edits. |

---

## 1. Functional Requirements (EARS)

### FR-1 — Popover opens from the More filters chip
**When** the user clicks the `More filters` `ToolbarChip` at `cards-filter-row.tsx:94-100`, **the system shall** open a `MoreFiltersPopover` anchored under the chip with the chip marked `aria-expanded="true"` and the popover marked `role="dialog"` `aria-labelledby` pointing at its heading.

### FR-2 — Three independent dimensions
**The system shall** render three independent controls inside the popover:

- **Pitch** — a segmented `PillGroup` with options `Any` / `Has pitch` / `Missing pitch`, plus a dependent pattern `Select` with options `Any` / `Heiban` / `Atamadaka` / `Nakadaka` / `Odaka`. The pattern `Select` is disabled (and visually muted, `aria-disabled="true"`) unless `Pitch === 'has'`.
- **Image** — segmented `PillGroup`: `Any` / `Has image` / `Missing image`.
- **Audio** — segmented `PillGroup`: `Any` / `Has audio` / `Missing audio`.

### FR-3 — Pattern auto-resets when its parent disables
**When** the user changes Pitch away from `has`, **the system shall** clear the pattern selection (no leftover `pitchPattern` in the query). This is computed during render, not via an effect.

### FR-4 — Apply / Reset
**The system shall** show two buttons in the popover footer:
- **Apply** — commits the staged state to `CardsFilters`, closes the popover, and (per existing `handleFilterChange`) deactivates any saved-view pill and resets `pageIndex` to 0.
- **Reset** — clears the three new dimensions inside the popover (does not close it). Distinct from `Apply` so the user can preview a reset without committing.

> **Why staged state rather than live commit:** without a staging buffer, each toggle inside the popover refires the cross-deck query and momentarily renders new rows behind the open popover. That violates FRONTEND § *Race conditions in async UI* and reads as flicker. Staged state keeps the user in control of one commit per intent.

### FR-5 — URL deep-link (read-once)
**When** the page loads with `?present=audio`, `?present=pitch&pitchPattern=atamadaka`, or any of the new tokens in the URL, **the system shall** parse those query params once on mount and seed the popover state (and the active query) accordingly. The parser tolerates unknown values silently (drops them rather than throwing). User-initiated filter changes do **not** push to the URL — mirrors the existing one-way pattern documented at `cards-browser-view.tsx:84-87`.

### FR-6 — Active-filter indicator
**Where** any of the three new dimensions is non-default, **the system shall** include them in the existing `filtersActive` computation at `cards-browser-view.tsx:339`, so the `Clear filters` affordance lights up. A small numeric badge on the `More filters` chip (count of non-default new dimensions) **shall** be visible whenever the count is ≥ 1.

### FR-7 — Saved views encode the new dimensions
**When** the user picks a saved view that includes `presentField` or `pitchPattern` in its recipe, **the system shall** apply those dimensions to the active query exactly as it already does for `missingField` (precedence: explicit popover state > recipe). The `SavedViewRecipe` interface at `saved-views-storage.ts:23-27` **shall** be extended with optional `presentField` / `pitchPattern` fields, and the localStorage envelope **shall** carry a `schemaVersion: 2` marker so older entries are detected and migrated (forward-only: missing fields become `undefined`).

### FR-8 — Filter row chip
**The system shall** rename the existing `More filters` chip label to reflect the count when filters are active: `More filters` (idle) → `More filters · 2` (badge form). Touch target ≥ 44×44px is preserved by the existing `ToolbarChip` sizing.

### FR-9 — Mutual exclusion at the UI
**When** the popover state has `Missing X` selected for image or audio, **and** the user activates the corresponding `Has X` chip, **the system shall** replace (not stack) the selection — the segmented control is single-select. The shared Zod `.refine` makes `missingField` + `presentField` on the same dimension impossible by construction; the UI inherits the constraint via the same single-control widget per dimension.

### FR-10 — Network failure / unsupported backend
**When** the API rejects the new params with a 400 (e.g., deploy ordering puts the migration after the web bundle), **the system shall** surface a recoverable toast `Filters not available yet — try again in a moment.` via the existing `showToast` channel. The query stays at the previous valid result rather than blanking the table (relies on TanStack Query's `keepPreviousData` semantics where applicable; if not currently enabled, set it on this query).

---

## 2. Non-Functional Requirements

### Accessibility (FRONTEND § UX, UI, and accessibility)
- **NFR-A1 — Keyboard.** Tab enters the popover at the first segmented option. Arrow keys move within a `PillGroup`. Tab moves between groups. Escape closes the popover and returns focus to the `More filters` chip. Apply on Enter when focus is inside the popover and not on a control with its own Enter handler.
- **NFR-A2 — Focus trap.** While the popover is open, focus does not escape to the page behind it. On close, focus returns to the trigger chip (FRONTEND § *Modals trap focus and restore on close* — popover counts here because it's transient and content-blocking).
- **NFR-A3 — Accessible names.** Each segmented option has `aria-pressed` set to its current state. The pattern `Select` has a visible label (`Pattern`) and `aria-describedby` pointing at help text that explains when it's disabled.
- **NFR-A4 — Contrast.** Disabled pattern `Select` retains 3:1 contrast against the popover surface (FRONTEND § WCAG AA).
- **NFR-A5 — Reduced motion.** Popover open/close uses opacity-only transition or instant under `prefers-reduced-motion: reduce`.
- **NFR-A6 — Touch.** Every chip / pill / select trigger ≥ 44×44 with ≥ 8px gap (FRONTEND § *Touch targets ≥ 44×44px*).
- **NFR-A7 — Semantic HTML.** Apply / Reset are `<button>` elements; the pattern `Select` uses the existing `TomoSelect` (combobox + listbox), not a custom div mash-up.

### Performance & bundle
- **NFR-P1 — No new heavyweight imports.** Popover composes from existing primitives only. No new package added to `apps/web/package.json`.
- **NFR-P2 — Lazy-load only if measured.** Initial size add expected < 6 KB gzipped (one new component file + small enum maps). Below the threshold where dynamic-import buys anything (FRONTEND § *Lazy-load heavy components* — applies to charts/editors, not a 6 KB popover).
- **NFR-P3 — Animations use compositor-only properties.** Popover open uses `opacity` + `transform: translateY(2px)` only; no width/height/top/left animation (FRONTEND § *Animations target compositor-only properties*).
- **NFR-P4 — Query-key stability.** New options serialize deterministically (object key order via the existing `queryKeys.cards.crossDeck` helper) so we don't accidentally fragment the cache. Verify with a unit test that two calls with the same logical options return identical keys.

### Error handling (FRONTEND § Error handling on the frontend)
- **NFR-E1 — Translated errors.** `apiCallSafe` already swallows 5xx / auth to the empty page; a 400 from the new validation surfaces via `liveQuery.error`. The popover surfaces a generic translated message — never the raw `error.message`.
- **NFR-E2 — Race conditions.** TanStack Query handles last-write-wins by query key. We do not introduce any imperative fetch.

### Internationalization
- **NFR-I1 — Strings collocated.** All strings live in the component (the codebase is currently not i18n'd; FRONTEND § *Internationalization-ready* applies only when an i18n system exists). If/when an i18n system is introduced, the popover strings are the kind that would extract cleanly — no string concatenation across word order.

---

## 3. Acceptance Criteria

### AC-1 — Click chip → popover opens with keyboard focus on first control
**Given** the cards browser is loaded with no filters,
**When** the user clicks **More filters**,
**Then** the popover opens within 200ms (sans `prefers-reduced-motion`), focus moves into the popover to the first interactive control, the chip shows `aria-expanded="true"`, and Escape returns focus to the chip and closes the popover.

### AC-2 — Has audio filter narrows the table
**Given** the user has cards with and without `expressionAudio`,
**When** the user opens the popover, picks **Audio → Has audio**, and clicks **Apply**,
**Then** the popover closes, the table re-fetches, the row count shrinks to only audio-bearing cards, the `More filters` chip shows the `· 1` badge, and any active saved-view pill deactivates.

### AC-3 — Pattern disabled unless Has pitch
**Given** Pitch is at `Any` or `Missing pitch`,
**When** the user inspects the pattern `Select` inside the popover,
**Then** the control is rendered disabled with `aria-disabled="true"`, the trigger is not keyboard-focusable, and the help text reads `Choose "Has pitch" to filter by pattern`.

### AC-4 — Switching Pitch back to Any clears pattern
**Given** Pitch is `Has pitch` and pattern is `Atamadaka`,
**When** the user switches Pitch to `Any`,
**Then** the pattern selection clears in the popover state (committed only on Apply); on Apply, the resulting query has neither `presentField=pitch` nor `pitchPattern`.

### AC-5 — Saved view including a new dimension
**Given** a built-in or user-created saved view with `recipe.presentField === 'audio'`,
**When** the user activates the view,
**Then** the popover state reflects `Audio → Has audio` next time it opens, the active query carries `presentField=audio`, and the filter chip shows the appropriate badge count.

### AC-6 — URL deep-link applies on mount
**Given** the user lands on `/cards?present=pitch&pitchPattern=atamadaka`,
**When** the page mounts,
**Then** the live query is issued with those params, the table renders only matching cards, and opening the popover shows `Pitch = Has pitch`, `Pattern = Atamadaka` pre-selected. Subsequent in-popover changes do not push to the URL.

### AC-7 — Backend rejects unknown combination
**Given** a stale web bundle that somehow constructs `?missingField=audio&presentField=audio` (we believe this is impossible via the UI, but the contract surface must hold),
**When** the API returns 400,
**Then** the table retains its previous rows, a toast surfaces `Filters not available yet — try again in a moment.`, and `liveQuery.error` is recoverable on the next valid filter change.

### AC-8 — Reduced motion respected
**Given** `prefers-reduced-motion: reduce`,
**When** the popover opens,
**Then** no opacity/transform animation runs; the popover appears instantly. Likewise for close.

---

## 4. Error Handling

| Condition | UI response | Where |
|---|---|---|
| API returns 400 from `.refine` | Toast `Filters not available yet — try again in a moment.` Existing rows stay visible. | `liveQuery.error` watcher inside `cards-browser-view.tsx` |
| API returns 5xx | Empty page via `apiCallSafe` fallback. Toast suppressed (existing behavior). | `lib/actions/cards.actions.ts:233` (unchanged) |
| URL contains unknown token (e.g. `?pitchPattern=flat`) | Silently dropped on parse; popover seeds remaining valid tokens. | `parsePopoverFromQuery` helper |
| Saved-view recipe is v1 (no schemaVersion) | Read as schemaVersion=1; new fields default to undefined. View still applies its known dimensions. | `useSavedViews` reducer |
| Saved-view recipe contains an enum value not admitted by the shared schema | View activation surfaces a translated toast `This saved view is from an older version.` and skips application. Doesn't crash. | `useSavedViews` apply path |

---

## 5. Implementation TODO

### New component
- [ ] `apps/web/app/(app)/cards/_components/more-filters-popover.tsx`
  - [ ] Composes from `Pill` / `PillGroup` / `TomoSelect` / `Button` (existing primitives).
  - [ ] Internal staging state: `{ pitch, pitchPattern, image, audio }` reset to props on open.
  - [ ] Portal via `createPortal` (mirrors `TomoSelect:43-46`); positioned via the trigger's `getBoundingClientRect()`.
  - [ ] Outside-click + Escape close; focus trap with first/last focusable-element loop.
  - [ ] Animation: opacity + 2px translateY; gated on `prefers-reduced-motion`.
  - [ ] Public props: `{ open, onClose, anchorRef, value, onApply }`. No `'use client'` directive needed inside the component file because its parent `cards-browser-view.tsx` is already client.

### Existing component edits
- [ ] **`cards-filter-row.tsx`**
  - [ ] Extend `CardsFilters` interface with `pitch: 'any' | 'has' | 'missing'`, `pitchPattern: PitchPattern | null`, `image: 'any' | 'has' | 'missing'`, `audio: 'any' | 'has' | 'missing'`. (Alternative: keep `CardsFilters` lean and add a sibling `CardsPresenceFilters` type. **Recommended:** sibling type to keep the popover's blast radius small and the row's existing API stable — bias toward the lower-coupling option per CODING_STANDARDS § *State at the right level*.)
  - [ ] Pass an `activeMoreFilterCount` prop to the chip so it renders the `· N` badge. Compute the count in the parent and pass it down — keep `CardsFilterRow` stateless.
  - [ ] Wire `onMoreClick` to a controlled `open` boolean owned by `CardsBrowserView`; pass an `anchorRef` for popover positioning.

- [ ] **`cards-browser-view.tsx`**
  - [ ] Add `presence` state (the sibling type from above), default to `{ pitch: 'any', pitchPattern: null, image: 'any', audio: 'any' }`. State lifted here because the popover, the query builder, the filter chip badge, and the saved-view sync all need it (FRONTEND § *State at the right level*: lifted to the lowest common ancestor).
  - [ ] Extend the URL-read effect at line 89-91 to also parse `?present=`, `?pitchPattern=`. Reuse the existing tolerant-parse pattern. Both parses run in the same `useEffect(searchParams)` block.
  - [ ] Extend the `queryOpts` `useMemo` at line 118 to translate the presence state into `presentField` / `pitchPattern` / extended `missingField`. Apply the existing recipe-precedence rule (`explicit filter row state > saved view recipe`).
  - [ ] Extend `filtersActive` at line 339 to include the new dimensions.
  - [ ] Extend the selection/page reset effect at line 157 to depend on the new presence state.
  - [ ] Replace the `handleMoreFilters` toast at line 335 with `setMoreFiltersOpen(true)` — the only direct contract change to the existing code.
  - [ ] Mount `<MoreFiltersPopover open={…} value={presence} onApply={(next) => { setPresence(next); setActiveViewId(null); setPageIndex(0); setMoreFiltersOpen(false); }} onClose={() => setMoreFiltersOpen(false)} anchorRef={moreChipRef} />`.

- [ ] **`saved-views-storage.ts`**
  - [ ] Extend `SavedViewRecipe` with `presentField?: CardPresentField`, `pitchPattern?: PitchPattern`. Import the new types from `@fsrs-japanese/shared-types`.
  - [ ] Bump the localStorage envelope's schema version to 2. Read path: v1 → upcast (new fields = undefined); v2 → consume as-is; unknown → discard with a warning to console.
  - [ ] Add two new BUILTIN_VIEWS — e.g. `missing-audio` ("Missing audio") and `has-pitch-atamadaka` ("Atamadaka cards") — so users can discover the dimensions without opening the popover. **Recommendation only**; tracked as optional UX polish in §6 below.

- [ ] **`lib/actions/cards.actions.ts`**
  - [ ] Extend `CrossDeckCardsActionOptions` with `presentField?: CardPresentField`, `pitchPattern?: PitchPattern`. Extend `cardMissingFieldEnum` import (already done by the shared schema).
  - [ ] Append `if (options.presentField !== undefined) params.set('presentField', options.presentField)` and equivalent for `pitchPattern` in `listCardsCrossDeckAction` (`cards.actions.ts:230-231`).

- [ ] **`lib/api/cards.ts`** — no edit needed; the hook spreads the entire `opts` object into the query key already.

- [ ] **`lib/api/queryKeys.ts`** — sanity-check that `queryKeys.cards.crossDeck(opts)` is order-stable on the new keys. If it currently spreads keys in declaration order, ordering is fine; if it sorts, fine too. Add a sentinel test (see §7).

### Types-level changes
- [ ] Import `CardPresentField`, `PitchPattern` from `@fsrs-japanese/shared-types` everywhere they're used. **No** new local copies of the enum. (CODING_STANDARDS § Monorepo hygiene.)

### Strings (a11y, copy)
- [ ] Define a small `STRINGS` map at the top of `more-filters-popover.tsx`: heading (`More filters`), per-dimension labels, help text for the disabled pattern select, Apply/Reset, error toast.

---

## 6. Out of Scope (Explicit)

- **Display of pitch/image/audio in the result table rows.** That's the polish-pass display side, tracked separately.
- **New saved-view UI for creating user-defined recipes with the new dimensions.** Existing curated presets get extended (optional); user-authoring UI of saved views is a larger surface and is out of scope here.
- **URL write-back / shareable filter state.** The plan keeps the existing one-way URL pattern. Adding two-way URL sync is a larger UX call that should be made for *all* filters or none.
- **i18n extraction.** Strings stay collocated; no translation system exists in the repo today.
- **Lazy-loading the popover.** < 6 KB add, no payoff in dynamic import.
- **Storybook stories.** The repo has no Storybook setup; adding one for a single component is out of scope.

---

## 7. Tests

Standards: CODING_STANDARDS § Tests + FRONTEND § Test patterns.

The repo currently has **no frontend test runner configured** (CLAUDE.md: "the frontend does not currently define a `test` script"). That makes adding component tests a scope question; introducing Vitest/React Testing Library now would be a new infrastructure dependency, which CODING_STANDARDS § *Working principles* says to surface rather than smuggle in.

### Surfaced decision
The plan assumes **no new frontend test infrastructure**. The component will be verified through:

1. **Type checks** — `bun run --filter @fsrs-japanese/web typecheck` catches every prop/options drift.
2. **Lint** — `bun run --filter @fsrs-japanese/web lint`.
3. **Manual browser verification** per CLAUDE.md: start `bun --filter web dev`, exercise every popover state (open/close, each dimension, pattern-disabled-then-enabled, Apply/Reset, URL deep-link, saved-view sync, prefers-reduced-motion), confirm a11y with keyboard-only navigation.
4. **Sentinel unit tests** if a tiny `bun:test` target makes sense in `apps/web/lib/api/__tests__/cards.test.ts` for the action-options serializer (no React; pure function). This stays inside the existing test runner already wired at the workspace level via `bun test`.

If we want component tests, surface that decision separately — it is a larger architectural change than this feature.

### Manual test matrix

| Scenario | Steps | Expected |
|---|---|---|
| Open + close | Click chip → popover opens; click outside → popover closes | Chip `aria-expanded` toggles; focus restored |
| Has audio | Audio → Has audio → Apply | Table narrows; `?` URL unchanged; badge shows `· 1` |
| Pattern dependency | Pitch=Has → pick Atamadaka → switch Pitch=Any → Apply | No `pitchPattern` in fetch |
| Saved view | Activate built-in `Atamadaka cards` view | Popover reflects state; query carries `presentField=pitch&pitchPattern=atamadaka` |
| Deep link | Open `/cards?present=audio` | Query carries `presentField=audio`; popover opens with the correct state |
| Reduced motion | DevTools → emulate reduced motion → open popover | No animation |
| Keyboard | Tab through popover; press Escape | Focus loops within popover; Escape returns to chip |
| Backend 400 | Forge a request via DevTools with both `missingField=audio` and `presentField=audio` | Toast surfaces; previous rows retained |

---

## 8. Risk & Rollback

- **Risk: deploy ordering.** If the web bundle ships before the migration runs on prod, the new filter options trigger 400s. Mitigation: the popover is opt-in (toast stub is replaced, but the default state is `Any` for every new dimension), so a fresh page load with no saved-view referencing the new dims sends no new params. Saved views that *do* reference new fields trip 400; the recoverable toast handles this. **Recommendation:** apply the migration first, deploy web second.
- **Rollback:** Reverting to the toast stub is a single file edit (`cards-browser-view.tsx`) plus removing the new component file plus optional revert of `saved-views-storage.ts` v2 envelope. The migration itself is forward-only and safe to leave applied — the schema and indexes do not affect any other code path.

---

*Plan generated 2026-05-19. Treat as the contract between the frontend PR and the standards files.*
