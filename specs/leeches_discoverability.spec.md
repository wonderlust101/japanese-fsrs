# Leeches Discoverability — Sidebar Sub-Nav Entry

**Status:** Draft (pending validation)
**Owner:** Frontend
**Related work:** Phase 1 leeches surface shipped 2026-05-17 at commit `1df955a`. This spec covers the discoverability fix only — no new page work, no backend work.
**Source brief:** [`docs/Add Leeches List and Drill Support.md`](../docs/Add%20Leeches%20List%20and%20Drill%20Support.md) §Navigation and Information Architecture: *"Add 'Leeches' as an Insights sub-route if the current navigation supports sub-nav."*

---

## 1. Overview and user value

### Problem
`/insights/leeches` is the dedicated triage surface for cards that keep coming back for another look (the *"weak spots"* page). It ships filters, a detail dialog, AI diagnosis, and resolve/reopen lifecycle actions. **But it has no first-class entry point in the chrome.** The only inbound link is an inline "Open weak spots →" anchor buried inside the Leeches section card on `/insights/mistakes` — a learner has to know that the Mistakes page contains a Leeches sub-section, scroll to it, and click an editorial link to reach the triage surface.

Every other Insights sub-page (Overview, Mistakes, Progress, Forecast, Statistics) is in the sidebar's `Insights` sub-nav already (`apps/web/app/(app)/_components/nav-config.ts:53-65`). Leeches is the only peer missing.

### Value
- **For the learner:** Weak-spot triage is one of the highest-leverage maintenance loops in spaced repetition. A learner with even one unresolved leech should see a quiet draw-the-eye signal in the sidebar without having to remember where the page lives.
- **For the product:** Closes the IA gap implied by the doc brief. Brings the route to the same discoverability tier as its peers.
- **For engineering:** Unblocks the Phase 2 drill flow's discoverability — when the drill page ships, its entry will be the same row.

### Goals
- Sidebar (and MobileDrawer, which inherits from sidebar config) carries a `Leeches` row under `Insights`.
- A count badge appears next to the row label when there are unresolved leeches; the row reads plain "Leeches" when there are none.
- No new backend endpoints, schemas, or migrations.

### Non-goals
- Phase 2 drill flow (`/insights/leeches/drill/*`) — tracked separately on the Kanban.
- Today screen surfacing (e.g. a "you have weak spots" Today card) — explicitly deferred per user direction.
- Insights Overview redesign to surface Leeches — explicitly deferred.
- Cards-browser saved-view pill repointing — explicitly deferred.
- A separate `/api/v1/leeches/count` endpoint — the existing list endpoint with `limit=1` is sufficient.

---

## 2. Functional requirements (EARS)

### Sidebar config
- **REQ-1:** The `Insights` section's `children` array in `apps/web/app/(app)/_components/nav-config.ts` shall include a new entry for `/insights/leeches` with `iconKey: 'browse'` and `label: 'Leeches'`.
- **REQ-2:** The new entry shall sit immediately after `/insights/mistakes` in the children array, so the IA pairing of *Mistakes → Leeches* reads top-to-bottom in the rail.
- **REQ-3:** The new `NavItemConfig` shall carry a new optional flag `hasLeechCount?: boolean` set to `true`, mirroring the existing `hasDueCount` precedent. The flag stays in the static config; live data is read at render time inside the sidebar/drawer.

### Live count derivation
- **REQ-4:** When the sidebar renders, the system shall fetch the count of unresolved leeches via the existing `useLeechesQuery({ status: 'unresolved', limit: 1 })` hook.
- **REQ-5:** Where the response has `items.length === 0` and `hasMore === false`, the system shall treat the unresolved count as `0`.
- **REQ-6:** Where the response has `items.length > 0` or `hasMore === true`, the system shall expose the count to the nav item decorator. (The count itself comes from a small dedicated query — see REQ-7 — so the badge can show real numbers, not just "≥1".)
- **REQ-7:** The system shall expose a `useUnresolvedLeechCount()` hook in `apps/web/lib/api/leeches.ts` that returns `{ count: number, isLoading: boolean }`. It fetches `useLeechesQuery({ status: 'unresolved', limit: 50, sort: 'mostRecent' })` and returns `items.length` (capped at 50, matching the request's `limit`); when `hasMore === true` the display layer renders `50+` instead of the raw integer.

### Badge rendering
- **REQ-8:** When the unresolved leech count is `0`, the Leeches nav row shall render the plain label "Leeches" with no badge.
- **REQ-9:** When the unresolved leech count is greater than `0`, the Leeches nav row shall render the label with a small count badge to the right. The badge displays the integer when `1–50`, and the literal `50+` when `hasMore === true`.
- **REQ-10:** The badge shall use the existing `Pill variant="status" tone="leech"` primitive from `apps/web/components/ui/Pill.tsx` (or, if visually too heavy, a smaller in-row count chip in the JetBrains Mono register at `text-[0.625rem]` per existing chrome — final visual register decided during implementation by comparing against the existing Reviews row sub-label rhythm).
- **REQ-11:** While the count query is loading and the user has never seen a hydrated value, the row shall render the plain label with no badge. The badge appears only on resolved data — no "loading shimmer" in the sidebar.
- **REQ-12:** Where the count query is in an error state, the row shall fall back to the plain label and not surface the error in the sidebar. (Errors in a sidebar badge are noise; the badge is decoration.)

### MobileDrawer
- **REQ-13:** Because `MobileDrawer` reads from the same `NAV_SECTIONS` config and uses the same `NavItem` component, the Leeches row and its badge shall appear identically in the mobile drawer without separate wiring.

### Collapsed-rail state
- **REQ-14:** When the sidebar is in its 64px collapsed rail state, the count badge shall be hidden along with the label (the rail shows icons only). The icon shall remain visible as the `browse` glyph, matching its peer sub-nav items.

### Active-state highlighting
- **REQ-15:** When the route is `/insights/leeches` or any descendant (`/insights/leeches/drill/*` in Phase 2), the Leeches row shall render in the active state per the existing `isMatch` logic — no changes to the active-state algorithm are required.

### Accessibility
- **REQ-16:** When the badge is present, the row's accessible name shall include the count, e.g. `aria-label="Leeches, 4 unresolved"`, so screen-reader users hear the badge in the row's name rather than as a separate floating element.

---

## 3. Non-functional requirements

| Dimension | Requirement |
|---|---|
| Performance | The count query shares the cache key family `queryKeys.leeches.list({...})` already established in Phase 1. Its `staleTime` shall remain `staleTimes.analytics` (1 hour) so the sidebar count is not refetched on every navigation. Successful resolve/reopen mutations already invalidate `queryKeys.leeches.all()` — no additional invalidation wiring is required. |
| Bundle size | The change shall add no new top-level dependencies. Implementation reuses `useLeechesQuery`, existing Pill primitive, and existing sidebar/drawer components. Expected bundle delta: <500 bytes. |
| SSR / hydration | The sidebar is a Client Component; the count hook fires on mount. The initial server render shows the plain label; the badge hydrates on the client. No hydration mismatch is possible because the badge is only rendered on the client after the query resolves. |
| Accessibility | WCAG 2.2 AA: badge contrast ≥4.5:1 against the warm-paper-raised sidebar background. Live count change announces via the row's existing focus state, not a polite-region announcement (the count change is decorative, not an interruption). |
| Privacy | The count query only fetches the authenticated user's leeches via the existing endpoint. No new data exposure. |
| Resilience | A query error (network, auth) shall NOT block the Leeches row from rendering or being clickable. The badge silently disappears on error. |

---

## 4. Acceptance criteria

### AC-1 — Sidebar entry present (clean install)

**Given** a learner is signed in and on `/today`
**When** they look at the Insights section of the sidebar
**Then** the row `Leeches` is rendered as the 6th child under `Insights`, immediately below `Mistakes`.

### AC-2 — Count badge appears for unresolved leeches

**Given** a learner has 4 unresolved leeches (status='unresolved')
**When** they expand the Insights section in the sidebar
**Then** the Leeches row shows the label `Leeches` with a count badge reading `4` within 2 seconds of the sidebar mount.

### AC-3 — No badge when zero unresolved

**Given** a learner has 0 unresolved leeches
**When** they expand the Insights section in the sidebar
**Then** the Leeches row shows the plain label `Leeches` with no badge or count.

### AC-4 — Cap-and-overflow on large counts

**Given** a learner has more than 50 unresolved leeches
**When** the sidebar count query resolves with `hasMore: true`
**Then** the badge renders `50+` rather than the raw integer.

### AC-5 — Resolving a leech updates the badge

**Given** a learner has 4 unresolved leeches with the sidebar visible
**When** they mark one resolved from `/insights/leeches`
**Then** the sidebar badge updates to `3` within 1 second (driven by the existing `invalidateQueries({ queryKey: queryKeys.leeches.all() })` in `useResolveLeechMutation`).

### AC-6 — Reopening a leech updates the badge

**Given** a learner has 3 unresolved leeches and 1 resolved leech with the sidebar visible
**When** they reopen the resolved leech
**Then** the sidebar badge updates to `4` within 1 second.

### AC-7 — Mobile drawer parity

**Given** a learner has 2 unresolved leeches and is on a viewport below `lg`
**When** they open the mobile drawer
**Then** the Leeches row and its `2` count badge are visible identically to the desktop sidebar.

### AC-8 — Collapsed rail hides the badge

**Given** the desktop sidebar is in its 64px collapsed rail
**When** the learner has unresolved leeches
**Then** the Leeches row icon is visible, the label is `sr-only`, and the count badge is not rendered.

### AC-9 — Active state on the leeches page

**Given** a learner is on `/insights/leeches`
**When** the sidebar renders
**Then** the Leeches row carries the active visual state (matching the styling of the other active Insights sub-nav rows).

### AC-10 — Query failure degrades silently

**Given** the leech list endpoint is returning a 5xx error
**When** the sidebar mounts
**Then** the Leeches row renders the plain label with no badge and remains clickable; no error UI appears in the sidebar.

### AC-11 — Accessible name includes the count

**Given** a learner has 4 unresolved leeches and uses a screen reader
**When** the screen reader focuses the Leeches row
**Then** it announces `Leeches, 4 unresolved` (or the platform-equivalent phrasing).

---

## 5. Error handling

| Failure mode | System response | User-facing impact |
|---|---|---|
| Count query 401 (unauthenticated) | Hook returns `{ count: 0, isLoading: false }` via the existing `apiCallSafe` fallback. | Row renders plain label; no badge. |
| Count query 5xx | Same as above — `apiCallSafe` returns the empty fallback. | Row renders plain label; no badge. |
| Count query network failure | `useQuery` resolves to `isError: true`; the badge selector hook returns `{ count: 0, isLoading: false }`. | Row renders plain label; no badge. |
| `hasMore === true` with `items.length` smaller than `limit` | Treat as `items.length`; the truncated-list flag indicates server pagination, not undercount. | Badge shows the actual length. |
| Mutation race (resolve fires before sidebar query refetch) | The invalidation from `useResolveLeechMutation`'s `onSuccess` triggers a sidebar query refetch automatically. | Badge updates within ~1s. |
| Pathological count > 9999 | Capped display at `50+` per REQ-9. | Badge stays compact. |

---

## 6. Implementation TODO checklist

### Step 1 — Add the nav-config entry
- [ ] Edit `apps/web/app/(app)/_components/nav-config.ts`: add a new entry `{ href: '/insights/leeches', iconKey: 'browse', label: 'Leeches', hasLeechCount: true }` to the `Insights` section's `children` array, immediately after the `Mistakes` entry.
- [ ] Add `hasLeechCount?: boolean` to the `NavItemConfig` interface.

### Step 2 — Add the count hook
- [ ] In `apps/web/lib/api/leeches.ts`, export a new hook `useUnresolvedLeechCount(): { count: number, hasMore: boolean, isLoading: boolean }`. It wraps `useLeechesQuery({ status: 'unresolved', limit: 50, sort: 'mostRecent' })` and projects to the count/hasMore/isLoading shape.

### Step 3 — Wire the badge in the sidebar
- [ ] Update `apps/web/app/(app)/_components/sidebar.tsx`: in `decorate()`, branch on `item.hasLeechCount === true` and pass a `leechBadge` prop (count + hasMore) to `NavItem`.
- [ ] Update `apps/web/app/(app)/_components/nav-item.tsx`: accept an optional `leechBadge?: { count: number; hasMore: boolean }` prop. When present and `count > 0`, render the badge next to the label using the chosen visual register (mono count chip OR Pill `status/leech`). Hidden in collapsed rail. Add `aria-label` augmentation when the badge is present.

### Step 4 — Wire the badge in the mobile drawer
- [ ] Update `apps/web/app/(app)/_components/mobile-drawer.tsx`: mirror the sidebar's decorator branch so children with `hasLeechCount` carry the same `leechBadge` prop.

### Step 5 — Verify cache invalidation
- [ ] Confirm `useResolveLeechMutation` and `useReopenLeechMutation` already invalidate `queryKeys.leeches.all()` — they do (Phase 1, `apps/web/lib/api/leeches.ts:78-85,92-98`). No mutation changes needed.

### Step 6 — Verify, typecheck, lint, build
- [ ] Manually verify the row appears, the badge appears when fixtures show unresolved leeches, the badge updates on resolve/reopen, and the row's active state lights when on `/insights/leeches`.
- [ ] `bun run --filter @fsrs-japanese/web typecheck`
- [ ] `bun run --filter @fsrs-japanese/web lint`
- [ ] `bun run --filter @fsrs-japanese/web build`

### Step 7 — Update kanban + status docs
- [ ] Update `docs/KANBAN_BOARD.md`: add a "Leeches sidebar entry shipped" line under Done; update the Phase 2 line to note discoverability is no longer blocking.
- [ ] Update `docs/status/FRONTEND.md`: extend the "Leeches surface" row to note the sidebar entry now ships discoverability.

### Step 8 — Commit
- [ ] One commit, message: `feat(web): surface leeches in the Insights sub-nav with unresolved-count badge`.

---

## 7. Open questions for validation

1. **Badge visual register:** Pill primitive (heavier, branded) vs. mono count chip (lighter, matches existing nav rhythm)? Recommend mono count chip for sidebar density.
2. **Cap value:** `50+` is the proposed overflow display. Acceptable, or prefer `99+`?
3. **Insights parent badge:** Should the Insights parent row also surface a roll-up badge when there are unresolved leeches, or keep the badge scoped to the child row only? Recommend child-only — parent badges add visual noise and the Insights parent is rarely collapsed.
