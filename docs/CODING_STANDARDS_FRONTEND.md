# Frontend Coding Standards

This file defines standards for frontend / client-side code in this monorepo. It complements [CODING_STANDARDS.md](CODING_STANDARDS.md), which must be read first for cross-cutting principles (working style, types, tests, monorepo hygiene, documentation, workflow). This file covers concerns specific to client-side work: component framework correctness, UX, accessibility, and bundle / runtime performance.

The conventions here are not preferences — they're requirements. If a change you're considering would violate one of these, stop and surface it for human review rather than silently working around it.

---

## Component framework correctness

These rules apply to any modern component framework (React, Vue, Svelte, Solid, Angular, etc.). Specific syntax differs; the principles don't.

- **Follow the framework's reactivity rules.** Each framework has rules about where state lives, when effects run, and what triggers re-renders. Violations cause subtle bugs that don't fail loudly. (e.g., React's Rules of Hooks, Vue's reactivity tracking, Svelte's rune scoping, Solid's signal granularity.) The framework's lint rule for these exists for a reason — don't disable it without justification.
- **Effects synchronize with external systems, not derive state.** Don't use effects (`useEffect`, `watchEffect`, `$effect`, etc.) to compute derived values from other state — derive during render or with the framework's memo primitive. Don't use effects to handle user events — events go in event handlers.
- **Effect cleanup runs.** Subscriptions, timers, and async operations that started in an effect get cleaned up when the effect re-runs or the component unmounts. Use the framework's cleanup return / disposal pattern. For async fetches, use `AbortController` to handle the case where dependencies change before the fetch resolves.
- **List keys are stable and unique.** Never use array index as a key when items can reorder, insert, or delete. Never use random values as keys. The key should identify the item across renders.
- **State at the right level.** Lifted only as high as the lowest common ancestor that needs it. Not duplicated. Not derived via an effect when it could be computed during render.
- **Server state in a query library.** Server data goes through a dedicated query library (TanStack Query, SWR, RTK Query, Pinia Colada, etc.) — not raw fetch + local state + manual refetch. Query keys include every variable that affects the query.
- **Server vs client component boundaries are deliberate.** In frameworks with this distinction (React Server Components, Astro islands, Qwik resumability, etc.), interactive components are explicitly marked client. Server components don't pass non-serializable values to client components. Client components don't import server-only modules — that leaks server code (and potentially secrets) into the client bundle.
- **Forms have validated state.** Server-side validation always (client-side is for UX feedback). Loading, error, success, and empty states are wired up on every async surface. Submit is guarded against double-submit.
- **Optimistic updates roll back on failure.** When the UI shows a state before the server confirms it, failure must restore the previous state visibly to the user.
- **File naming follows location.** Shared, reusable components under `apps/web/components/**` use PascalCase filenames matching the exported component (`FuriganaText.tsx`, `TomoLoader.tsx`). Route-local components under an `app/**/_components/` folder use kebab-case (`deck-list.tsx`, `setup-client.tsx`). Asset-style modules — icon sets and chart primitives in `components/icons/` and `components/charts/` — use kebab-case (`chrome-marks.tsx`, `primitives.tsx`). Rule of thumb: a thing rendered as `<Foo />` from many routes is PascalCase in `components/`; a thing tied to one route is kebab-case in that route's `_components/`.
- **Store and hook filenames follow their shape.** A store that exports a single hook is `useXxxStore.ts` (`useReviewSessionStore.ts`). A store *module* that also exports domain constants beside the hook is `xxx.store.ts` (`onboarding.store.ts` — it exports `ONBOARDING_STEPS` / `NEXT_STEP` next to `useOnboardingStore`). Standalone utility hooks in `hooks/` are kebab-case `use-xxx.ts` (`use-countdown.ts`). Route-local hooks extracted beside a component in an `app/**/_components/` folder are kebab-case `use-<feature>-<concern>.ts` (`use-deck-prefs.ts`, `use-cards-url-filter-state.ts`).
- **Async UI states are owned by the client component, not the route.** Loading / error / empty / populated are derived from the query library (TanStack Query's `isLoading` / `isError` / empty-data checks) and rendered inline — that's the primary mechanism. Next.js route-group `error.tsx` / `loading.tsx` exist as the server-render and last-resort boundary; every route group (`(app)`, `(auth)`, `(marketing)`) has an `error.tsx`.
- **A client-component page puts its `metadata` in the sibling `layout.tsx`.** A `"use client"` `page.tsx` can't export `metadata`, so its title is declared in a server `layout.tsx` next to it (the `review/*` routes do this: `layout.tsx` → `{ title: "…" }`). Don't declare the title in both the layout and the page (it's redundant — they merge), and never add `title.template` to a child layout — it replaces the root `%s | Tomo` template entirely rather than nesting.

---

## UX, UI, and accessibility

- **Use the design system.** Colors, spacing, typography, radii, shadows, z-index from tokens — not magic values. No `padding: 13px` when the spacing scale is 4/8/12/16. No new "primary blue" — find the existing one.
- **Component variants over hand-rolled.** If the design system has a Button, use it. Don't re-implement what exists — extend or contribute upstream if needed.
- **Semantic HTML before ARIA.** Native interactive elements before custom ones: `<button>` not `<div onClick>`, `<a href>` for navigation, `<label>` for inputs. The first rule of ARIA is don't use it if a native element works.
- **Heading hierarchy reflects document structure.** One `<h1>` per page representing the main subject; no level skips (no h2 → h4); headings reflect outline, not visual size.
- **Keyboard accessible.** Every interactive element is reachable by Tab, operable with Enter/Space, and has a visible focus indicator. Modals trap focus and restore on close. Route changes move focus to a meaningful landmark for screen reader users.
- **Accessible names on every interactive element.** Icon-only buttons have an accessible label. Form inputs have an associated label. Links describe their destination, not "click here".
- **WCAG AA contrast minimum.** 4.5:1 for body text, 3:1 for large text and UI elements. Don't convey information by color alone — pair with icon, text, or shape so color-blind users get the signal.
- **Respect `prefers-reduced-motion`.** Animations and transitions disabled or instant when the user has set the preference. Especially: parallax, auto-playing motion, and large-movement transitions.
- **Touch targets ≥ 44×44px.** Especially close buttons, pagination, icon-only buttons. Spacing between adjacent targets ≥ 8px to prevent mistaps.
- **No hover-only interactions.** Anything triggered by hover must also be triggerable by focus or click — touch devices have no hover.
- **Every async surface has four states.** Loading, error, empty, success. No blank screens during loading or on error. Empty states are distinct from "no items match this filter" and have appropriate calls to action.
- **Microcopy explains and acts.** Errors describe what went wrong AND what to do — not "Invalid input." Empty states have a CTA. Buttons describe the action ("Save changes" not "OK"). Confirmation dialogs explain consequences.
- **Responsive and mobile-friendly.** Layout works at typical mobile widths and at 200% text zoom. Forms use appropriate input types so mobile keyboards match (e.g., `type="email"`, `type="tel"`, `inputmode` attribute).
- **Internationalization-ready.** No hardcoded strings if the codebase is internationalized — extract to the translation system. No string concatenation that breaks word order in other languages — use ICU placeholders. Dates and numbers via the platform's i18n APIs.

---

## Error handling on the frontend

(See [CODING_STANDARDS.md](CODING_STANDARDS.md) for general error handling principles.)

- **Top-level error boundary.** Catches unexpected errors so they don't blank the page.
- **Per-feature / per-route error boundaries.** Localized failures don't take down the whole app. The fallback UI offers recovery (refresh, retry, navigate away).
- **API errors translated to user-meaningful messages.** Don't render raw `error.message` from the server — sanitize and contextualize. Specific known errors get specific messages; unexpected errors get a generic message + correlation ID.
- **Network failures handled.** Offline state, timeout state, server unavailable — all distinct from validation errors. Each gets appropriate user feedback.
- **Race conditions in async UI.** Search-as-you-type, dependency-change refetches: the latest result wins, even if an earlier one resolves later. Use cancellation (`AbortController`, query library's built-in cancellation) to enforce this.

---

## Test patterns specific to the frontend

(See [CODING_STANDARDS.md](CODING_STANDARDS.md) for general test principles.)

- **Test through the user-visible interface.** Find elements by accessible role, label, or text — not by class names, refs, or internal state. Tests that break on refactor without behavior changes are testing the wrong thing.
- **Component tests for component logic.** Verify behavior in isolation with the framework's testing library (e.g., React Testing Library, Vue Test Utils, Svelte Testing Library). Don't unit-test components by inspecting internals.
- **Integration tests for cross-component flows.** State management, routing, form submission flows.
- **End-to-end for critical user paths.** Sign-up, login, primary product flows. Sparse and high-value — don't try to e2e-test everything.
- **Mock APIs at the network layer.** Tools like MSW intercept fetches without coupling tests to the HTTP client. Mocks reset between tests.
- **Test loading, error, empty, and success states.** Not just the happy path. UI bugs hide in the states that "shouldn't normally happen."
- **Accessibility regressions caught in tests.** Use accessibility-aware assertions (axe-core, accessible queries) on key views. Manual testing with assistive technology for high-traffic flows.

---

## Performance and bundle impact

(See [CODING_STANDARDS.md](CODING_STANDARDS.md) for general performance principles.)

- **No accidentally large imports.** Use granular imports for utility libraries (e.g., `import { debounce } from 'lodash-es'` not the full lodash). Avoid known-large libraries when lighter alternatives exist (e.g., Moment.js — use a lighter date library). Per-component imports for UI libraries when they support tree-shaking.
- **No server code in client bundles.** Components meant for client execution don't import server-only modules (database clients, secret-using config). Server-only environment variables never leak through client-exposed prefixes.
- **Lazy-load heavy components.** Charts, editors, PDF viewers, code editors, modal contents — dynamic-import them so they're not in the initial bundle. Bundle the entry route lean.
- **Memoize only when justified.** Manual memoization (`useMemo`, `useCallback`, `React.memo`, Vue's `computed` for non-reactive values, etc.) only when the computation is genuinely expensive or reference identity matters for downstream memoization. Don't cargo-cult.
- **Sized images, lazy-loaded below the fold.** Width and height attributes always (prevent layout shift). `loading="lazy"` below the fold. Mark the LCP image with `fetchpriority="high"` and don't lazy-load it.
- **Modern image formats.** WebP/AVIF where supported; sized via responsive sources for the actual device.
- **Font loading doesn't block render.** `font-display: swap` (or `optional`); preload fonts critical to first paint; subset to the characters used.
- **Avoid render-blocking third parties.** Analytics, chat widgets, ads — loaded asynchronously. Self-host where possible to reduce DNS / TLS round trips.
- **Animations target compositor-only properties.** Transform and opacity, not top/left/width/height. Avoid layout thrash.
- **Long lists virtualized.** Lists of 50+ items use a virtualization library; rendering all at once degrades on lower-end devices.
- **Core Web Vitals tracked.** LCP, INP, CLS measured in production via real user monitoring. Regressions caught in CI via Lighthouse or equivalent budget gates.
