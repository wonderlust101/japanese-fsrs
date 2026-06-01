"use client";

/**
 * Page-level section-reveal cascade — the sibling of `useEnterSettle`, one level
 * up: where `useEnterSettle` settles *within* a single moment surface (ornament
 * → copy), the reveal hooks cascade the **peer sections of a page** into view.
 *
 * Keyed on a standardized `data-reveal` attribute, with an optional
 * `data-reveal-lead` for the one element (usually the page header) that lands
 * first, ahead of the cascade. The hook collects
 * `[data-reveal]:not([data-reveal-lead])` in DOM order and staggers them; the
 * lead (at most one) lands at full duration with the cascade overlapping its
 * tail at `-=0.2`.
 *
 * Properties: `opacity` 0→1 and `y: 12→0` ONLY — never `autoAlpha`. Sections
 * carry headings, real copy, live data, and interactive controls, all of which
 * must stay in the a11y tree throughout the tween (constraint #7 / §4.4).
 * `visibility:hidden` would drop them out of the AT tree and find-in-page. This
 * is the load-bearing difference from the Pass-1 ornament hooks.
 *
 * ── Two-hook split (spec §P2.1 / §P2.7) ──────────────────────────────────────
 * The public contract is two named hooks, NOT a single `useReveal({ mode })`
 * dispatcher. A dispatcher would have to statically import BOTH
 * `@/lib/motion/register` and `@/lib/motion/register-scroll`; because
 * `gsap.registerPlugin(ScrollTrigger)` is a module-scope side effect, that
 * static import would drag ScrollTrigger (~10kB brotli) into EVERY reveal
 * route's chunk — defeating the bundle split. Two separate files, each with a
 * single static register import, let the bundler keep ScrollTrigger out of
 * mount-only routes. Callers pick:
 *
 *   - `useRevealMount(ref, opts)`  — core register, no ScrollTrigger, fires on
 *     mount. For above-the-fold hub/moment pages and list/detail header chrome.
 *   - `useRevealScroll(ref, opts)` — register-scroll, ScrollTrigger `once`. Only
 *     on routes already carrying ScrollTrigger via Pass-1 charts (insights).
 *
 * The `RevealOptions.mode` literal is kept on the shared type as documentation
 * of which hook a route chose, and so a future single dispatcher could be added
 * if the bundle constraint ever relaxes; today, importing the matching named
 * hook IS the dispatch.
 *
 * `rootRef` must be the page CONTENT root *inside* PageFrame, never PageFrame
 * itself (PageFrame keeps its CSS `page-enter` — constraint #4, no double-anim).
 */

export { useRevealMount } from "./use-reveal-mount";
export { useRevealScroll } from "./use-reveal-scroll";
export type { RevealOptions } from "./use-reveal-shared";
