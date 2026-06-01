# Dashboard Motion Spec — Stage 2 (Motion Design)

> Specifications for the first GSAP motion on Tomo's `(app)` dashboard surfaces.
> Consumed by the Stage 3 Implementation Agent. This document defines *what moves, why, and how it feels* — not production code. Pseudo-snippets are illustrative.
>
> Grounding read: `docs/DESIGN.md` §Motion ("Responsive by default; no scroll-driven choreography in product chrome"), `apps/web/app/globals.css` easing tokens + keyframes, and the established GSAP house idiom in `apps/web/app/(auth)/_components/auth-shell.tsx`.

---

## 1. Motion design principles

1. **Motion confirms, never performs.** On product chrome (the entire `(app)` tree) animation exists to confirm a state change — a thing arrived, a thing left, a value updated, data finished loading. It is never decoration for its own sake. DESIGN.md classes product chrome as *Responsive*, not *Choreographed*; the brand register (auth/onboarding/marketing) is the only place motion may show off.
2. **Fast and ease-out-dominant.** Everything lives in **0.2s–0.9s** with a deceleration curve (`expo.out` / `quint.out` / `power*.out`). The motion arrives quickly and settles softly — the "weighted exhale" already used by the CSS keyframes. Nothing eases *in* (accelerates) on entrance; entrances decelerate into rest.
3. **Transform + opacity only.** Animate `x`, `y`, `scale`, `opacity`, and SVG `strokeDashoffset`. Never animate layout (`width`, `height`, `top`, color) in GSAP — those stay in the tuned CSS `ui-motion-*` utilities. This keeps everything on the compositor at 60fps.
4. **One motion system per element.** Constraint #1 is absolute: a surface is either CSS-keyframe-animated *or* GSAP-animated, never both on the same node. `page-enter` stays CSS; GSAP opt-in is per-surface and replaces, never layers.
5. **Subtle travel, generous fade.** Translate distances stay small (8–24px) — matching `card-reveal`'s -8px and auth-shell's 12–20px. The fade does the perceptual work; the travel is a hint of direction, not a journey.
6. **Stagger is punctuation, not a parade.** Use stagger only where multiple peer items genuinely arrive together (chart series, heatmap cells, hero stat row). Keep per-item offset at **0.04–0.08s** and cap total cascade length so a list never feels like it's "loading in" slowly.
7. **The accessibility tree never moves.** Real values, real copy, and anything a screen reader or find-in-page must read stays statically in the DOM at full opacity. Decorative duplicates and ornaments get `autoAlpha`; text-in-the-a11y-tree gets `opacity` only (per constraint #3).
8. **Frequent workflows stay instant.** Anything in the review grading loop, drill loop, tables, nav, and forms is forbidden (see Stage-1 do-not-animate list). If a motion would add latency to something a user does dozens of times a session, it does not ship.

---

## 2. Animation specifications by component

All specs assume the universal gating contract in §4 (every effect wrapped in `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`, scoped via `useGSAP({ scope: rootRef })`, `data-*` hooks). Named easings map to the tokens centralized in §3.

### P0

#### 2.1 `components/ui/Dialog.tsx` — modal open/close

- **Trigger:** `open` prop transitions `false → true` (enter) and `true → false` (exit). The native `<dialog>` `.showModal()`/focus trap is unchanged; GSAP animates **only the box and backdrop visuals**, never focus.
- **Elements & hooks:** `data-dialog-box` on the warm-paper panel; `data-dialog-backdrop` on the sumi-ink scrim layer. (The current component renders the backdrop via `::backdrop`/blur; if `::backdrop` can't be tweened by GSAP, add a real backdrop div with this hook — implementer's call, flag to Stage 4.)
- **Enter:**
  - Backdrop: `autoAlpha 0 → 1` (decorative, `aria-hidden`).
  - Box: `scale 0.98 → 1`, `opacity 0 → 1`, `y 8 → 0` (tiny rise reinforces "lifting into the top layer").
  - **Duration:** box 0.32s, backdrop 0.2s. **Easing:** `expo.out`. **Sequence:** backdrop and box start together; backdrop is shorter so the stage darkens just ahead of the panel landing.
- **Exit:** reverse — box `scale 1 → 0.98`, `opacity → 0`, `y → 6` over **0.18s** `power2.out` (`quint.in` not used — exits stay short and quiet); backdrop `autoAlpha → 0` over 0.18s. The component must hold the actual `<dialog>` mount until the exit tween completes (`onComplete` → call the existing close), or the box vanishes before it can animate. Flag this teardown ordering to Stage 4.
- **autoAlpha vs opacity:** backdrop = `autoAlpha` (purely decorative). Box = `autoAlpha` is acceptable here too because the native focus trap, not visibility, owns interactivity — but prefer `opacity` + an explicit `pointerEvents` guard if the box contains live focusable content during the tween.
- **Reduced-motion end-state:** dialog appears/disappears instantly at final opacity/scale; native `<dialog>` open/close only.

```ts
// pseudo
mm.add("(prefers-reduced-motion: no-preference)", () => {
  if (!open) return;
  gsap.set(box, { autoAlpha: 0, scale: 0.98, y: 8 });
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.to(backdrop, { autoAlpha: 1, duration: 0.2 }, 0)
    .to(box, { autoAlpha: 1, scale: 1, y: 0, duration: 0.32 }, 0);
  return () => { tl.kill(); gsap.set(box, { clearProps: "opacity,visibility,transform" }); };
});
```

#### 2.2 `app/(app)/_components/page-frame.tsx` — route enter

- **Decision: LEAVE AS-IS. Do not add GSAP.** The `(app)` route enter is owned by the existing CSS `page-enter` keyframe (and per-surface `today-fade-in`). Per constraint #1, adding a GSAP settle here would either double-animate (banned) or require ripping out tuned, reduced-motion-correct CSS for zero perceptual gain. Page-level enter is a *Responsive* beat that CSS already nails.
- **Net spec:** no `data-*` hook, no GSAP, no change. PageFrame is the seam where individual child surfaces (charts, hero, empty states) opt into GSAP — the frame itself stays CSS.
- **Reduced-motion:** already handled by the global `@media (prefers-reduced-motion: reduce)` duration-zeroing on `page-enter`.

#### 2.3 `components/ui/Toast.tsx` + `components/ui/PeekPanel.tsx` — enter/exit slide+fade

- **Trigger:** toast pushed/dismissed; peek panel opened/closed.
- **Hooks:** `data-toast-root`, `data-peek-root`.
- **Toast enter:** `y 12 → 0` (rises from below, the direction toasts stack from), `autoAlpha 0 → 1`. **Duration:** 0.28s. **Easing:** `expo.out`.
- **Toast exit:** `autoAlpha 1 → 0`, `y → -6`, **0.18s** `power2.out`. Hold unmount until `onComplete`.
- **PeekPanel enter:** `x` from edge offset → 0 (panel slides from the side it's anchored to — read the existing anchor class; default +24px from right), `autoAlpha 0 → 1`. **Duration:** 0.34s. **Easing:** `expo.out`.
- **PeekPanel exit:** reverse `x → +16`, `autoAlpha → 0`, **0.2s** `power2.out`.
- **autoAlpha vs opacity:** Toast has `role="status"|"alert"` — its content is in the a11y/live-region tree. The live region must announce on mount **regardless of visual state**, so the announcement must not depend on the tween. Use **`opacity`** on the toast (keep `visibility: visible` so the live region fires) rather than `autoAlpha`. PeekPanel: `autoAlpha` is fine *only if* the panel is not a focus target mid-tween; if it traps/receives focus, use `opacity` + `pointerEvents` guard.
- **Stagger:** none (single transient element each).
- **Reduced-motion:** instant appear/disappear at final state; live-region semantics unchanged.

#### 2.4 Charts — `components/charts/primitives.tsx` + `paths.ts` + `ScrollableChartFrame.tsx` (and consumers like `retention-ribbon-chart`, `mature-stacked-area`, `new-card-impact-card`) — line/area draw-on

- **Trigger:** **ScrollTrigger, `once: true`** (matches marketing; constraint #2). Fires when the chart's `<svg>` enters viewport (`start: "top 85%"`).
- **Hooks:** `data-chart-line` on stroked `<path>`s (the `smoothLinePath` outputs); `data-chart-area` on filled area/band `<path>`s; `data-chart-frame` on the `ScrollableChartFrame` root that owns the ScrollTrigger.
- **Line draw-on:** animate SVG `strokeDashoffset` from full-length → 0 (classic stroke draw). Implementer sets `strokeDasharray = pathLength; strokeDashoffset = pathLength` then tweens offset → 0. **Duration:** 0.7–0.9s (longer end of the scale is allowed here — the draw *is* the content, and it fires once). **Easing:** `quint.out` (matches the `--ease-out-quint` used for "mature progress fill" — the existing curve-for-data-reveal precedent).
- **Area/band fill:** `autoAlpha 0 → 1`, optionally `scaleY 0.96 → 1` with `transformOrigin` at the baseline. **Duration:** 0.5s. **Easing:** `expo.out`. **Sequence:** fill fades in starting at `-=0.5` so the area arrives just behind the leading edge of the line draw (line leads, fill follows — never the reverse, which looks like the data "deflates").
- **Focal dots / reference lines / legend:** `autoAlpha 0 → 1`, **0.3s**, staggered `0.05s`, beginning at `-=0.2` (after the line is mostly drawn).
- **Multi-series:** stagger the lines by `0.08s`.
- **autoAlpha vs opacity:** all chart marks are decorative SVG (the figure has a `<figcaption>` / `aria-label` summary that carries the data for AT) → **`autoAlpha`** throughout.
- **Reduced-motion:** chart renders fully drawn at the static final state — no dashoffset, full fill opacity. The ScrollTrigger is simply not created inside the matchMedia gate.
- **Gotcha for Stage 3/4:** `strokeDashoffset` requires `getTotalLength()` on a mounted path; paths are computed from data and may re-render on data change. Capture length inside `useGSAP` after layout, and re-init on the data dependency. The dashoffset draw must be *added* in JS, not baked into `paths.ts` (keep `paths.ts` pure path-string math).

```ts
// pseudo (inside matchMedia, scope = frameRef)
const line = frameRef.current.querySelector("[data-chart-line]");
const len = line.getTotalLength();
gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
gsap.set(area, { autoAlpha: 0 });
const tl = gsap.timeline({
  scrollTrigger: { trigger: frameRef.current, start: "top 85%", once: true },
});
tl.to(line, { strokeDashoffset: 0, duration: 0.8, ease: "quint.out" })
  .to(area, { autoAlpha: 1, duration: 0.5, ease: "expo.out" }, "-=0.5");
```

#### 2.5 `components/ui/EmptyState.tsx` + `components/ui/KitsuneEmptyState.tsx` — ornament + copy settle

- **Trigger:** mount (these render when a query resolves empty; no scroll trigger needed — they're typically above the fold and are a "moment").
- **Hooks:** `data-empty-ornament` on the icon/kitsune mark (decorative, `aria-hidden`); `data-empty-copy` on the title + body + action wrapper (sequenced children).
- **Ornament:** `scale 0.96 → 1`, `autoAlpha 0 → 1`. **Duration:** 0.45s. **Easing:** `expo.out`.
- **Copy + action:** `y 10 → 0`, `opacity 0 → 1`, staggered `0.06s` across [title, body, action]. **Duration:** 0.4s each. **Easing:** `power2.out`. **Sequence:** copy begins at `-=0.25` so it overlaps the tail of the ornament settle (ornament leads).
- **autoAlpha vs opacity:** ornament = `autoAlpha` (decorative); copy + action = **`opacity`** (title is an `<h2>`, body and CTA are real content in the a11y tree — must stay visible to AT through the tween).
- **Stagger:** 0.06s on the copy group only.
- **Reduced-motion:** everything at final state instantly.

---

### P1

#### 2.6 `components/ui/StatTile.tsx` — metric count-up (constraint #3)

- **Trigger:** mount, when `value` is numeric. (If `value` is a non-numeric `ReactNode`, skip count-up entirely — guard on `typeof value === "number"` or a parseable numeric string.)
- **Hooks:** the component must render **two nodes**: the real value `<span>` stays in the DOM at full opacity carrying the true text (screen-reader + find-in-page truth); add an `aria-hidden` visual twin `data-stat-countup` that the tween drives. The real node sits behind/under it (or the twin replaces it visually) — the implementer decides the layering, but the AT-readable value must never be the animated node.
- **Animation:** tween a proxy object's number `0 → value` and write the rounded, locale-formatted result into the `aria-hidden` twin's `textContent` on `onUpdate`. The twin's container also gets `opacity 0 → 1`. **Per constraint #3, animate `opacity`, never `autoAlpha`,** on the visual node.
- **Duration:** 0.6s. **Easing:** `expo.out` (number decelerates into its final value — matches the "settle" feel).
- **Stagger:** when a row of StatTiles mounts together (hero stat row), the *parent* should stagger their count-ups by `0.06s`; an individual StatTile does not self-stagger.
- **Reduced-motion:** the `aria-hidden` twin renders the final value immediately at full opacity; no count. The real value node is unaffected in all cases.

```ts
// pseudo
if (typeof value !== "number") return;            // skip non-numeric
const proxy = { n: 0 };
gsap.set(countupEl, { opacity: 0 });
gsap.to(countupEl, { opacity: 1, duration: 0.4, ease: "expo.out" });
gsap.to(proxy, {
  n: value, duration: 0.6, ease: "expo.out",
  onUpdate: () => { countupEl.textContent = format(Math.round(proxy.n)); },
});
// real value <span> is untouched, stays in the a11y tree
```

#### 2.7 `today/_components/today-hero*.tsx` + `week-rhythm-strip.tsx`

- **Trigger:** mount (above the fold — the dashboard landing moment).
- **Hooks:** `data-hero-headline` (greeting/headline), `data-hero-meta` (supporting line), `data-rhythm-cell` (each day cell in the week strip).
- **Hero:** headline `y 12 → 0` + `opacity 0 → 1`, 0.5s `expo.out`; meta line same, 0.42s, beginning `-=0.32` (headline leads). **`opacity`** — these are content text.
- **Week-rhythm-strip:** the 7 day cells `autoAlpha 0 → 1` + `y 8 → 0`, **stagger `0.05s`**, 0.35s `power2.out`. Cells are decorative summaries with a text/aria fallback → **`autoAlpha`** acceptable; if a cell label is the only place a day's count is exposed to AT, use `opacity`. Total cascade ≈ 0.35 + 6×0.05 = 0.65s — within budget.
- **Note:** `today-hero` currently uses the `today-fade-in` CSS keyframe (globals.css:701). **Per constraint #1, pick ONE.** Recommendation: if hero opts into GSAP, remove `today-fade-in` from that element so they don't stack. Flag to Stage 3 to audit which elements carry `today-fade-in` before wiring GSAP.
- **Reduced-motion:** all at final state instantly.

#### 2.8 `review/summary/_components/closure-card.tsx`

- **Trigger:** mount (post-session closure — a deliberate "moment" page, `desktopCentered` PageFrame). This is *outside* the grading loop (the loop is forbidden; the summary screen is not the loop).
- **Hooks:** `data-closure-card` (the card), `data-closure-stat` (the summary stat rows/figures inside).
- **Card:** `scale 0.98 → 1`, `y 12 → 0`, `opacity 0 → 1`. 0.5s `expo.out`.
- **Stats inside:** `opacity 0 → 1` + `y 8 → 0`, stagger `0.07s`, 0.4s `power2.out`, beginning `-=0.25` after the card lands. **`opacity`** (summary numbers are content). Any StatTiles here reuse the §2.6 count-up rather than a separate fade.
- **Reduced-motion:** final state instantly.

#### 2.9 `components/charts/YearHeatmap.tsx` — cell stagger

- **Trigger:** **ScrollTrigger `once: true`** (it's a long page, often below fold) — consistent with §2.4.
- **Hooks:** `data-heatmap-cell` on each `<rect>`; reuse `data-chart-frame` on the figure root for the trigger.
- **Cells:** `autoAlpha 0 → 1`, **grid stagger** using GSAP `stagger: { each: 0.004, grid: [rows, cols], from: "start" }` so the fill sweeps left-to-right (calendar reading order). Keep `each` tiny — there can be 365+ cells; total sweep must stay under ~0.9s. **Duration per cell:** 0.25s. **Easing:** `power2.out`.
- **autoAlpha:** decorative `<rect>`s (the grid has `role="grid"` with per-cell `aria-label`; the *semantics* are static in the DOM and not animated — only the visual `<rect>` fill opacity moves) → **`autoAlpha`**. Do not animate the `role="gridcell"` wrappers' presence; only the visual rect opacity.
- **Reduced-motion:** all cells at full opacity immediately; no ScrollTrigger created.
- **Gotcha:** the heatmap also has interactive selection/tooltip — ensure the cell tween touches only `opacity`/`visibility`, never anything that interferes with the existing `aria-activedescendant` keyboard model.

#### 2.10 `_components/mobile-drawer.tsx`

- **Trigger:** drawer open/close (`< lg` only — gate the matchMedia to also require a max-width, or rely on the drawer only mounting below lg).
- **Hooks:** `data-drawer-panel` (the sliding panel), `data-drawer-backdrop` (the 40% sumi-ink scrim).
- **Open:** panel `x` from `-100%` (or `-320px`) → 0, 0.32s `expo.out`; backdrop `autoAlpha 0 → 1`, 0.24s.
- **Close:** panel `x → -100%`, 0.24s `power2.out`; backdrop `autoAlpha → 0`, 0.2s. Hold unmount until panel exit `onComplete`.
- **autoAlpha vs opacity:** backdrop = `autoAlpha`. Panel = transform-only on `x`; keep it visible (`opacity` untouched) so the nav inside stays in the a11y tree and focusable as it slides. **Do not** `autoAlpha` the panel.
- **Important:** the **sidebar collapse and nav active-state are forbidden** (tuned CSS, do-not-animate list). This spec covers only the drawer's open/close *slide*, not nav-item internals. The nav rows inside the drawer keep their existing CSS treatments.
- **Reduced-motion:** drawer appears/disappears instantly at final position; backdrop toggles without fade.

---

## 3. Timing & easing system

Centralize in **`apps/web/lib/motion/easings.ts`** so no surface re-types a magic number. Names mirror the CSS tokens in `globals.css` so the GSAP and CSS systems stay one language.

```ts
// apps/web/lib/motion/easings.ts

/**
 * GSAP easing names mapped 1:1 to the CSS easing tokens in globals.css.
 * Keep these in sync — GSAP and CSS describe the same curves.
 */
export const EASE = {
  /** ↔ --ease-out-expo  cubic-bezier(0.16,1,0.3,1). Default entrance curve
   *  (card draw, nav settle, dialog/toast/peek/hero enter). The "exhale". */
  out: "expo.out",
  /** ↔ --ease-out-quint cubic-bezier(0.22,1,0.36,1). Data-reveal curve
   *  (chart line draw, mature progress fill). */
  data: "quint.out",
  /** auth-shell precedent: secondary settle / row cascade. */
  settle: "power3.out",
  /** Short exits and trailing cascades. */
  exit: "power2.out",
} as const;

/** Duration scale (seconds). ease-out-dominant, 0.2–0.9s band. */
export const DUR = {
  /** micro confirmations, exits */        xs: 0.18,
  /** small enters (legend, meta, cells) */ sm: 0.28,
  /** standard enter (dialog box, copy) */  md: 0.34,
  /** card / hero / count-up settle */      lg: 0.5,
  /** chart draw-on (the one long beat) */  xl: 0.8,
} as const;

/** Stagger offsets (seconds). */
export const STAGGER = {
  copy: 0.06,      // empty-state / closure copy groups
  series: 0.08,    // multi-series chart lines
  cells: 0.05,     // week-rhythm strip
  heatmap: 0.004,  // year heatmap grid sweep (per-cell)
} as const;
```

- **Entrance default:** `EASE.out` (expo). **Data reveal:** `EASE.data` (quint). **Exit:** `EASE.exit` (power2). Never use an ease-*in* on an entrance.
- **Duration band:** strictly 0.18s–0.9s. Only the chart draw-on (`DUR.xl`) reaches the top.

---

## 4. Reduced-motion rules (universal gating contract)

This is mandatory for **every** dashboard GSAP effect. GSAP does **not** respect the global `@media (prefers-reduced-motion: reduce)` CSS rule (that rule only zeroes CSS `animation`/`transition` durations). Each effect self-gates:

1. Wrap **all** tween/timeline/ScrollTrigger creation inside:
   ```ts
   const mm = gsap.matchMedia();
   mm.add("(prefers-reduced-motion: no-preference)", () => {
     // ...build tweens / timelines / ScrollTriggers here...
     return () => {/* local cleanup; clearProps on text nodes */};
   });
   return () => mm.revert();
   ```
   In the house idiom this lives inside `useGSAP(() => { ... }, { scope: rootRef })` so scoping + revert are handled.
2. **When reduced-motion is preferred, nothing is created** — no `gsap.set` that hides, no ScrollTrigger, no count-up. The DOM must therefore render at its **natural final visible state** by default (full opacity, no transform, charts fully drawn, real values present). Hidden start-states are applied *only inside* the `no-preference` branch via `gsap.set`, so a reduced-motion user (or a JS failure) never sees a blank/half-drawn surface.
3. **Cleanup must `clearProps`** any text node touched (`opacity,transform`), mirroring auth-shell's `gsap.set([...], { clearProps: "opacity,transform" })`, so an interrupted client-route re-run can never strand content invisible.
4. **a11y-tree nodes:** `opacity` (never `autoAlpha`) so `visibility:hidden` never drops live regions / headings out of the AT tree. Decorative-only nodes: `autoAlpha`.
5. The chart/heatmap ScrollTriggers use `once: true` and are created only in the `no-preference` branch.

---

## 5. Animation priority list (ships in pass 1)

**P0 — ship first, in order:**
1. `Dialog` open/close (box scale+fade, backdrop fade).
2. `page-frame` — **no-op / leave CSS** (decision recorded; no work).
3. `Toast` + `PeekPanel` enter/exit slide+fade.
4. Charts draw-on (`primitives` / `paths` consumers / `ScrollableChartFrame`), ScrollTrigger `once`.
5. `EmptyState` + `KitsuneEmptyState` ornament + copy settle.

**P1 — second wave:**
6. `StatTile` count-up (aria-hidden twin, `opacity`).
7. `today-hero*` + `week-rhythm-strip` (resolve `today-fade-in` CSS overlap first).
8. `closure-card` settle.
9. `YearHeatmap` cell stagger (ScrollTrigger `once`).
10. `mobile-drawer` open/close slide.

**Deferred (not this pass):** deck-list reorder FLIP (constraint #4).
**Forbidden (never spec'd):** review grading loop, weak-spot drill, sidebar collapse, nav active-state, scannable tables/list rows, form inputs/editors, `TomoLoader`.

---

## 6. Handoff notes for the GSAP Implementation Agent

### Standardized `data-*` hook names (use exactly these)
| Surface | Hooks |
|---|---|
| Dialog | `data-dialog-box`, `data-dialog-backdrop` |
| Toast | `data-toast-root` |
| PeekPanel | `data-peek-root` |
| Charts (all) | `data-chart-frame` (ScrollTrigger root), `data-chart-line`, `data-chart-area` |
| EmptyState / KitsuneEmptyState | `data-empty-ornament`, `data-empty-copy` |
| StatTile | `data-stat-countup` (the aria-hidden visual twin) |
| Today hero | `data-hero-headline`, `data-hero-meta` |
| Week rhythm strip | `data-rhythm-cell` |
| Closure card | `data-closure-card`, `data-closure-stat` |
| YearHeatmap | `data-heatmap-cell` (reuse `data-chart-frame` on the figure) |
| Mobile drawer | `data-drawer-panel`, `data-drawer-backdrop` |

### Where shared code goes
- `apps/web/lib/motion/easings.ts` — the `EASE` / `DUR` / `STAGGER` constants from §3 (new file; the folder does not exist yet — create it).
- `apps/web/hooks/` — if a reusable pattern emerges (e.g. a `useScrollDrawOn(ref)` wrapping the matchMedia + ScrollTrigger `once` + `getTotalLength` dashoffset for charts, and a `useEnterSettle(ref, opts)` for the card/copy enter pattern), put it here. **Recommend building `useScrollDrawOn`** since §2.4 and §2.9 share the exact ScrollTrigger-`once` + reduced-motion gate skeleton.
- Mirror the auth-shell idiom: `useGSAP` from `@gsap/react` with `{ scope: rootRef }`; `gsap.set()`+`.to()` (not `from`) so client-route re-runs can't strand elements hidden; `clearProps` cleanup.
- `ScrollTrigger` must be registered once (`gsap.registerPlugin(ScrollTrigger)`) — it already ships in the bundle (constraint #5); check it isn't double-registered.

### Per-surface gotchas
- **Dialog & drawer & toast & peek exit ordering:** the element must stay mounted until the exit tween's `onComplete`. React unmount-on-`open=false` will kill the box before it animates. Either keep mounted during exit (preferred) or accept enter-only animation and let close be instant — confirm with Stage 4 which is acceptable per surface. **Recommendation: enter-animated + instant-or-quick-exit** to keep complexity down; only Dialog/drawer truly benefit from an exit tween.
- **Dialog backdrop:** if GSAP can't tween the native `::backdrop`, add a real `aria-hidden` backdrop div with `data-dialog-backdrop`. Flag the chosen approach.
- **`today-fade-in` collision (§2.7):** audit which today-hero elements carry the `today-fade-in` CSS class and remove it from any element you GSAP-animate (constraint #1 — never both).
- **Charts `getTotalLength()`:** capture path length after mount/layout inside `useGSAP`; re-init on the data dependency. Keep `paths.ts` pure (no animation logic there).
- **StatTile:** only animate when `value` is numeric; the real value `<span>` stays untouched in the a11y tree; the count-up node is `aria-hidden` and uses `opacity` (constraint #3 — never `autoAlpha`).
- **Heatmap:** touch only rect `opacity`/`visibility`; do not interfere with `aria-activedescendant` / `role="gridcell"` keyboard selection.
- **Toast a11y:** keep `visibility: visible` (use `opacity`, not `autoAlpha`) so `role="status"|"alert"` live regions announce on mount.
- **Size budget:** GSAP + ScrollTrigger already in bundle; no new GSAP plugins are required by this spec (no Flip — deferred; no SplitText; no DrawSVG — the stroke draw uses plain `strokeDashoffset`, not the paid plugin). Keep it that way so `.size-limit.json` stays green.

---

## Pass 2 — Page section reveals

> Incremental pass. Specifies the page-level **section-reveal cascade** — the sibling of `useEnterSettle`, one level up: where `useEnterSettle` settles *within* a single moment surface (ornament → copy), `useReveal` cascades the **peer sections of a page** into view. Same principles, tokens, easings, and reduced-motion contract as Pass 1 (§1, §3, §4); this section only adds the new hook, the per-route assignment, the insights sequencing rule, and the no-reveal list. Pseudo-snippets are illustrative.

### P2.1 — `useReveal(rootRef, opts)` spec

New hook, file `apps/web/hooks/use-reveal.ts`. A section-level cascade keyed on a standardized `data-reveal` attribute, with an optional `data-reveal-lead` for the one element (usually the page header/heading) that must land *first*, ahead of the cascade.

#### Signature / options

```ts
interface RevealOptions {
  /**
   * "mount"  → imports gsap/useGSAP from `@/lib/motion/register` (NO ScrollTrigger).
   *            Fires once on mount. For above-the-fold hub/moment pages.
   * "scroll" → imports from `@/lib/motion/register-scroll`. Wraps the timeline in a
   *            ScrollTrigger { start: "top 85%", once: true }. For long, scrolled pages
   *            (insights) that already pay the ScrollTrigger cost via charts.
   */
  mode: "mount" | "scroll";
  /** Section travel distance (px). Default 12 (the house "subtle travel"). */
  y?: number;
  /** Per-section stagger (s). Default STAGGER.cells (0.05). Capped — see below. */
  stagger?: number;
  /** Section duration (s). Default DUR.md (0.34). */
  duration?: number;
  /**
   * Hard cap on total cascade time (s). The hook clamps the *effective* stagger so
   * duration + (count-1)*stagger never exceeds this. Default 0.7 (the insights budget).
   * This is what keeps a 5-section stack subtle and FAST regardless of section count.
   */
  maxCascade?: number;
  /** Re-run dependencies (e.g. a data/content key). Default []. */
  deps?: ReadonlyArray<unknown>;
}

export function useReveal(rootRef: RefObject<HTMLElement | null>, opts: RevealOptions): void;
```

#### Hook contract — the `data-*` attributes

- `data-reveal` — every peer section that participates in the cascade. The hook collects `root.querySelectorAll("[data-reveal]")` in DOM order and staggers them.
- `data-reveal-lead` — **optional, at most one.** The heading/header block that lands *first* (full duration, no stagger offset), with the `data-reveal` cascade beginning at `-=0.2` so the body sections overlap the tail of the lead. If absent, the cascade simply starts at `t=0` and the first `data-reveal` is the lead implicitly.
- A node may carry **both** is not allowed — a `data-reveal-lead` is *not* also counted in the `data-reveal` set (the hook excludes lead from the cascade query: `[data-reveal]:not([data-reveal-lead])`).

#### Properties / duration / easing / stagger (from §3 tokens)

- **Properties: `opacity` 0 → 1 and `y: 12 → 0` only.** No `scale`, no `autoAlpha`. Sections contain headings, real copy, live data, and interactive controls — all of which must stay in the a11y tree throughout the tween (constraint #7 / §4.4). `opacity` (not `autoAlpha`) is therefore **mandatory** here; `visibility:hidden` would drop section headings and controls out of the AT tree and find-in-page. This is the single most important rule of the hook.
- **Why `opacity` only (not the §2.6/§2.7 `autoAlpha` ornaments):** a revealed section is never decorative — it is the page's actual content blocks. The travel is the directional hint; the fade does the perceptual work (constraint #5).
- **Duration:** `DUR.md` (0.34s) per section. **Easing:** `EASE.out` (expo) — the standard entrance "exhale." **Stagger:** `STAGGER.cells` (0.05s) per section, **clamped** so the whole cascade finishes within `maxCascade` (default 0.7s). A 5-section insights stack: 0.34 + 4×0.05 = 0.54s — within budget. If a page ever has enough sections that 0.34 + (n-1)×0.05 > 0.7, the hook shrinks the stagger; it never extends the cascade. Over-animation is the primary risk (constraint #1 / brief) — the cascade is punctuation, not a parade (constraint #6).

#### The two mode code-paths (split so mount-only routes never pull ScrollTrigger)

The hook must be **one file with a mode switch on the import**, but the import split is the whole point of the bundle hygiene. Because `gsap.registerPlugin(ScrollTrigger)` is a module-scope side effect, *any* module that statically imports `@/lib/motion/register-scroll` drags ScrollTrigger into its chunk. To keep mount-only routes clean, the scroll path must be **dynamically imported inside the `mode === "scroll"` branch**, never statically at the top of `use-reveal.ts`:

```ts
// pseudo — use-reveal.ts
"use client";
import { DUR, EASE, STAGGER } from "@/lib/motion/easings";
// MOUNT path: static import is safe — core register has NO ScrollTrigger.
import { gsap, useGSAP } from "@/lib/motion/register";

export function useReveal(rootRef, { mode, y = 12, stagger = STAGGER.cells,
                                     duration = DUR.md, maxCascade = 0.7, deps = [] }) {
  useGSAP(() => {
    const root = rootRef.current; if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const lead = root.querySelector<HTMLElement>("[data-reveal-lead]");
      const sections = gsap.utils.toArray<HTMLElement>(
        root.querySelectorAll("[data-reveal]:not([data-reveal-lead])"));
      if (!lead && sections.length === 0) return;

      // clamp stagger to the cascade budget
      const n = sections.length;
      const eff = n > 1 ? Math.min(stagger, Math.max(0, (maxCascade - duration) / (n - 1))) : 0;

      const hide = [lead, ...sections].filter(Boolean);
      gsap.set(hide, { opacity: 0, y });                 // hidden start ONLY in no-preference

      const build = (st) => {
        const tl = gsap.timeline({ defaults: { ease: EASE.out, duration }, ...(st && { scrollTrigger: st }) });
        if (lead) tl.to(lead, { opacity: 1, y: 0 }, 0);
        if (sections.length) tl.to(sections, { opacity: 1, y: 0, stagger: eff }, lead ? "-=0.2" : 0);
        return tl;
      };

      let tl;
      if (mode === "scroll") {
        // SCROLL path: dynamic import keeps ScrollTrigger OUT of the mount chunk.
        // The page is already a ScrollTrigger consumer (charts), so no net cost.
        import("@/lib/motion/register-scroll").then(() => {
          tl = build({ trigger: root, start: "top 85%", once: true });
        });
      } else {
        tl = build(undefined);   // mount: fires immediately, no ScrollTrigger
      }

      return () => { tl?.scrollTrigger?.kill(); tl?.kill();
        gsap.set(hide, { clearProps: "opacity,transform" }); };   // a11y nodes -> clearProps
    });
    return () => mm.revert();
  }, { scope: rootRef, dependencies: [...deps] });
}
```

Implementation note for Stage 3: a dynamic `import()` inside `useGSAP` is async, so guard the cleanup against `tl` being undefined (shown above) and consider awaiting the import before the matchMedia body if the flicker between hidden-set and trigger-creation proves visible. The simpler alternative — **ship two tiny hooks, `useRevealMount` (static `register`) and `useRevealScroll` (static `register-scroll`), behind a thin `useReveal` re-export** — sidesteps the async dynamic import entirely and gives the bundler a clean static split. **Recommended: the two-hook split** (matches the existing `register` vs `register-scroll` precedent and the `useEnterSettle`/`useScrollDrawOn` precedent — one hook per chunk cost). The single-`mode`-prop signature above is the public contract; back it with two internal implementations.

#### SectionCard / PageHeader passthrough recommendation

- **`SectionCard` should emit `data-reveal` via a prop passthrough** — do NOT wrap each card in an extra `<div data-reveal>`. Add an opt-in boolean prop `reveal?: boolean` (default `false`) that spreads `data-reveal` onto the outer `<section>`:
  ```tsx
  <section {...(reveal && { "data-reveal": "" })} className={outerClass}>
  ```
  This keeps the attribute on the existing semantic node (no wrapper divs, no extra DOM, the `aria-labelledby`/stripe structure untouched). Default `false` so existing call sites are unaffected; routes opt in per the table below.
- **`PageHeader` participates as `data-reveal-lead`** — but, like SectionCard, behind an opt-in prop rather than always-on. Add `revealLead?: boolean` (default `false`) that spreads `data-reveal-lead` onto the `<header>`. Rationale: the header is the natural "lands first" element on hub/moment pages, and making it the lead keeps the heading from popping in mid-cascade. On routes where the header should stay **static** (list/detail pages where only a sub-block reveals, or where the header is sticky chrome), simply leave `revealLead` off and the header renders at rest immediately. Do NOT hard-wire either attribute into the primitives.
- Today's `GreetingHeader` (separate from `PageHeader`) is **excluded** — `/today` is on the no-reveal list (already animated).
- **StatTile count-up interaction:** a `StatTile` (or `ProgressSummaryStrip` / hero stat row) inside a revealed `SectionCard` must sequence its §2.6 count-up to **start at or after the section lands**, not during the opacity-0 phase (a number ticking up inside an invisible card is wasted motion and can finish before the user sees it). Stage 3: gate the count-up start on the section's reveal completion — simplest is to delay the count-up by the section's reveal offset (its stagger index × `eff` + a small lead), or trigger it from the same timeline. Flag to Stage 4: if `useReveal` (page-level) and `useEnterSettle`/StatTile count-up (card-level) are separate hooks on nested nodes, coordinate via a shared delay constant rather than two independent `t=0`s.

### P2.2 — Per-route timing table

| Route / surface | Mode | Sections that reveal (`data-reveal`) | Lead (`data-reveal-lead`) | Stagger | Finish budget |
|---|---|---|---|---|---|
| **insights `progress-view`** | scroll | the 5 stacked `SectionCard`s (summary, retention, mature, JLPT, consistency) | `PageHeader` | `STAGGER.cells` 0.05, clamped | ≤ 0.7s (5: ~0.54s) |
| **insights `forecast-view`** | scroll | each `SectionCard` / workload block | `PageHeader` | 0.05, clamped | ≤ 0.7s |
| **insights `statistics-view`** | scroll | each stat `SectionCard` (retention-comparison, long-curve, cumulative-due, …) | `PageHeader` | 0.05, clamped | ≤ 0.7s |
| **`review/setup` (setup-controls)** | mount | the setup `SectionCard`(s) / option groups | `PageHeader` | 0.05 | ≤ 0.55s |
| **`weak-spots/drill/setup`** | mount | drill-setup option `SectionCard`s | `PageHeader` | 0.05 | ≤ 0.55s |
| **insights overview (`insights-overview`)** | mount | the lead headline `<section>` + the 2-col group `<section>`s (2 reveal targets) | the headline section (or `PageHeader` if present) | 0.05 | ≤ 0.45s |
| **`add-client`** | mount | ONE beat — the single form-chrome block (no stagger; one `data-reveal` or just lead) | the page header | n/a (single) | ≤ 0.34s |
| **`cards-browser-view` (cards)** | mount | HEADER + TOOLBAR block only (NOT rows) | header | 0.05 (2 items) | ≤ 0.44s |
| **`deck-list` (decks)** | mount | header → tabs block (NOT deck rows/cards) | header | 0.05 (2 items) | ≤ 0.44s |
| **`weak-spots-view`** | mount | header + toolbar/summary block (NOT the list) | header | 0.05 | ≤ 0.44s |
| **`deck-detail-view`** | mount | header only (NOT the card table) | header | n/a (single) | ≤ 0.34s |
| **`card-detail-view`** | mount | 2–3 slabs: identity → card-back → history | identity slab | 0.05–0.06 | ≤ 0.46s |
| *P2-low:* **settings sections** | mount | single `SectionCard` settle (reuse `useEnterSettle`, low value) | — | none | ≤ 0.34s |
| *P2-low:* **`/decks/premade`** | scroll *(or mount fallback)* | catalogue `SectionCard`s / category blocks | `PageHeader` | 0.05, clamped | ≤ 0.7s |
| *P2-low:* **`add/review`** | mount | chrome only (form-adjacent header), NOT the editor fields | header | none | ≤ 0.34s |
| *P2-low:* **deck preview** | mount | header / summary chrome only (NOT the preview card list) | header | 0.05 | ≤ 0.44s |

All budgets derive from `DUR.md` (0.34) + (count−1) × clamped stagger, capped by `maxCascade`. The clamp guarantees these are upper bounds.

### P2.3 — Sequencing rule for insights (section reveal vs chart draw-on)

The insights routes run **two scroll systems on the same figures**: the Pass-2 `useReveal` (scroll mode) fading the `SectionCard` in, and the Pass-1 `useScrollDrawOn` drawing the chart *inside* that card. Both use `ScrollTrigger { start: "top 85%", once: true }`. They must not collide — **a chart must never begin its `strokeDashoffset` draw while its containing section is still `opacity: 0`,** or the draw is wasted (invisible) and the section then fades in over a half-drawn line.

**Rule: the section fade LEADS, the chart draw-on FOLLOWS.**

1. The two triggers fire at the same scroll position (same `top 85%`), but the **section reveal is short** (`DUR.md` 0.34s) and the **chart draw is long** (`DUR.xl` 0.8s). Because the section reveal completes in ~0.34s and the chart draw runs ~0.8s, the natural duration difference already biases the section to finish first.
2. To make this **guaranteed** rather than incidental, the chart's `useScrollDrawOn` ScrollTrigger should fire slightly *later* than the section reveal. Two acceptable mechanisms for Stage 3 (pick one, document it):
   - **(a) Stagger the trigger start lines:** section reveal at `top 85%`, chart draw at `top 80%` (chart starts ~one section-height later in the scroll). Simple, no cross-hook coupling.
   - **(b) Add a small `delay` to the chart draw timeline** (e.g. `delay: DUR.md` ≈ 0.34s) so even when both triggers fire together, the line begins drawing only after the section has faded in. **Recommended (b)** — it's robust to viewport/layout variance where (a)'s pixel offsets can invert on short sections.
3. **Invariant to encode:** `section.opacity === 1` before `line.strokeDashoffset` starts animating. The section reveal owns `opacity`; the chart owns `strokeDashoffset` + `autoAlpha` on its own marks (Pass 1). They touch disjoint properties on disjoint nodes, so there is no GSAP conflict — only a *timing* ordering to enforce.
4. Do **not** merge the two into one timeline. They live on different nodes (page section vs chart figure), different hooks, different concerns. Keep them independent ScrollTriggers and enforce ordering via the delay/offset only.

### P2.4 — Reduced-motion contract (reuse, verbatim)

`useReveal` reuses the **universal gating contract from §4** with zero deviation:

1. All `gsap.set` (hidden start), timeline, and ScrollTrigger creation live **inside** `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`.
2. When reduced-motion is preferred, **nothing is created** — no hidden `gsap.set`, no ScrollTrigger. **The SSR markup is the reduced-motion state:** every `data-reveal` section renders at full opacity, no transform, immediately. GSAP bypasses the global `@media (prefers-reduced-motion: reduce)` CSS reset, so this self-gate is the only thing standing between a reduced-motion user and a blank page — it is mandatory.
3. **Cleanup `clearProps: "opacity,transform"`** on every touched section (they are a11y-tree nodes), mirroring `useEnterSettle`, so an interrupted client-route re-run can never strand a section invisible.
4. **`opacity` only, never `autoAlpha`** — sections carry headings/copy/controls (§4.4). This is non-negotiable for `useReveal`.

### P2.5 — Bundle note (mount vs scroll per route; the premade flag)

- **Mount-mode routes pull NOTHING new.** They import the core `@/lib/motion/register` (no ScrollTrigger), which already lives in the shared common chunk. `review/setup`, `weak-spots/drill/setup`, `insights-overview`, `add-client`, `cards-browser-view`, `deck-list`, `weak-spots-view`, `deck-detail-view`, `card-detail-view` add zero plugin weight.
- **Scroll-mode insights routes (`progress`, `forecast`, `statistics`) pull NOTHING new either** — they already ship ScrollTrigger in their route chunk via the Pass-1 chart draw-on (`useScrollDrawOn`). `useReveal({ mode: "scroll" })` reuses the same `register-scroll` module already present in those chunks. Free.
- **`/decks/premade` is the ONE net-new ScrollTrigger cost.** It is not currently a ScrollTrigger consumer. Choosing `mode: "scroll"` would pull ScrollTrigger (~10kB brotli) into the premade route chunk. **Flag for Stage 4 / size budget:** if `.size-limit.json` is tight, ship `/decks/premade` as **`mode: "mount"` with no stagger** (a single header settle) — the spec'd mount-no-stagger fallback — rather than paying for ScrollTrigger on a route that otherwise wouldn't carry it. Recommend defaulting to the **mount fallback** unless the catalogue is genuinely long enough below the fold that a scroll reveal earns the 10kB. Stage 4 makes the call against the live budget.
- The two-hook split (`useRevealMount` / `useRevealScroll`, P2.1) is what makes this clean: a mount route statically importing only `useRevealMount` can never accidentally drag `register-scroll` into the common chunk.
- No new GSAP plugins. No Flip, no SplitText, no DrawSVG. The reveal is plain `opacity` + `y` tweens on the core API.

### P2.6 — Explicit no-reveal list (forbidden `data-reveal`)

Never attach `data-reveal` / `data-reveal-lead` to, and never run `useReveal` over:

- **`/today`** — already animated (today-hero GSAP §2.7 + `today-fade-in` CSS). A page-level reveal would collide with the existing today-fade-in. Hard forbidden.
- **Review grading loop** — every per-card grading beat. Frequent-workflow rule (constraint #8); forbidden in Pass 1.
- **Weak-spot drill SESSION loop** — the in-session card loop (the drill *setup* page is allowed; the *loop* is not).
- **All scannable tables and list rows** — deck rows/cards, card table rows, weak-spot list items, cards-browser result rows, premade catalogue *rows*. Reveal the HEADER/TOOLBAR chrome only; the scannable content stays static so it's instantly readable and find-in-page works. (constraint: tables/list rows on the Pass-1 forbidden list.)
- **All form fields / editors** — card editor sections, add/review form fields, setup *inputs* (the option `SectionCard` chrome may reveal; the individual fields do not), settings inputs.
- **Sidebar, `nav-item`, mobile-drawer nav rows** — tuned CSS / Pass-1 forbidden.
- **`TomoLoader`** — never.
- **Any node already carrying a motion system** — `page-enter`, `card-reveal`, `today-fade-in` CSS, or a Pass-1 hook (`deck-card.tsx`, `session-details-card.tsx`, today-hero, charts, StatTile twin, EmptyState, etc.). **One motion system per element (constraint #4).** If a section's outer node already animates, it does NOT get `data-reveal`; reveal a parent wrapper or skip it.

### P2.7 — Handoff notes for the GSAP Implementation Agent

- **File:** `apps/web/hooks/use-reveal.ts`. **Recommended shape:** two internal hooks `useRevealMount` (static `@/lib/motion/register`) and `useRevealScroll` (static `@/lib/motion/register-scroll`), exposed through one `useReveal(ref, { mode, ... })` that dispatches on `mode`. This gives the bundler a clean static split (mount routes never touch `register-scroll`) and avoids an async dynamic import inside `useGSAP`. Mirror the `useEnterSettle` / `useScrollDrawOn` file idiom exactly (matchMedia gate, `gsap.set`+`.to` not `.from`, `clearProps` cleanup, `{ scope, dependencies }`).
- **Exact stagger cap:** `eff = count > 1 ? Math.min(STAGGER.cells, Math.max(0, (maxCascade - DUR.md) / (count - 1))) : 0`. `maxCascade` default **0.7s**. Never let a cascade exceed it; shrink the stagger, never extend the timeline. A 5-section insights stack lands in ~0.54s.
- **Tokens (no magic numbers):** `y: 12`, `duration: DUR.md` (0.34), `stagger: STAGGER.cells` (0.05), `ease: EASE.out` (expo). Lead overlap offset `"-=0.2"`.
- **`opacity` ONLY — never `autoAlpha`.** Sections hold headings/copy/controls; `visibility:hidden` would drop them from the a11y tree and find-in-page. This is the load-bearing difference from the Pass-1 ornament hooks.
- **SectionCard prop name: `reveal?: boolean`** (default `false`) → spreads `data-reveal` onto the existing outer `<section>` (no wrapper div). **PageHeader prop name: `revealLead?: boolean`** (default `false`) → spreads `data-reveal-lead` onto the `<header>`. Both opt-in; default-off leaves every existing call site unchanged.
- **`data-reveal-lead` is excluded from the cascade query** — use `[data-reveal]:not([data-reveal-lead])` for the staggered set, and target the lead separately so it lands first with the body overlapping its tail at `-=0.2`. At most one lead per page.
- **Insights sequencing (P2.3):** add a `delay ≈ DUR.md` to the Pass-1 chart `useScrollDrawOn` timeline on the insights routes (or offset the chart trigger to `top 80%`) so the line never draws while its section is still `opacity:0`. **Recommended: the delay.** Keep the two ScrollTriggers independent — do not merge.
- **StatTile/count-up coordination:** delay any §2.6 count-up inside a revealed `SectionCard` until that section has landed (gate on the section's reveal offset, or a shared delay constant). A number ticking up inside an opacity-0 card is wasted.
- **`/decks/premade` budget flag:** prefer `mode: "mount"` (no stagger, header settle) to avoid pulling ScrollTrigger (~10kB) into a route that otherwise wouldn't carry it. Only choose `mode: "scroll"` if Stage 4 confirms `.size-limit.json` has headroom AND the catalogue is long enough below the fold to earn it.
- **Gotchas:** (1) `useReveal` runs at the page-component level; ensure `rootRef` is the page content root *inside* PageFrame, not PageFrame itself (PageFrame keeps its CSS `page-enter` — constraint #4, do not double-animate). (2) Do not attach `data-reveal` to any node listed in §P2.6. (3) Reduced-motion: SSR markup IS the final state; never set a hidden start outside the matchMedia branch.
