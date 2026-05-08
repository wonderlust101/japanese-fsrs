# Design Brief: `globals.css` Migration to Vermillion-on-Paper

**Status:** Confirmed by user on 2026-05-08. Implementation pending.
**Origin:** `$impeccable shape` run for `craft globals.css migration`.
**Register:** product (per PRODUCT.md).
**Source of truth:** PRODUCT.md and DESIGN.md (this brief commits no creative deviation; it is a migration plan).

---

## 1. Feature Summary

Migrate `apps/web/app/globals.css` and every dependent component file from the "Familiar Indigo Default" token system to the new Vermillion-on-Paper system specified in DESIGN.md. The migration is a **hard rename** (descriptive slugs replace generic ones), **bundles the Inter → DM Sans font swap**, and produces **full visual coherence** at the end state. No indigo color values render anywhere in the running app after this lands.

This is the foundational work that unblocks subsequent component-redesign craft passes (kanji nav glyphs, four-channel rating buttons, danger-ghost replacement, lucide retirement).

## 2. Primary Goal

A learner opening the app after the migration sees:

- Page background, card surfaces, and chrome render in warm-paper neutrals (`#FBF8F4` / `#FDFBF7` / `#F4EFE6`).
- All accents, focus rings, primary buttons, active nav, progress fills render in Inari Vermillion (`#B03646`).
- Body copy renders in Sumi Ink (`#1F1A18`); secondary text in Faded Sumi (`#6B5F58`).
- Latin text renders in DM Sans; Japanese text renders in Noto Sans JP (unchanged).
- JLPT badges preserved untouched.
- App compiles, type-checks, and runs with no console errors at any viewport.

**Explicitly deferred and *not* in this PR:** lucide-react icon retirement, kanji nav glyphs, four-channel rating button glyphs, the auth-screen "AI-Enhanced Japanese SRS" copy fix, replacing the literal `友日` wordmark text with `logo.svg`, type-scale revisions. Each is its own follow-up craft pass.

## 3. Design Direction

Pulled verbatim from DESIGN.md (no per-surface override). Full palette strategy: Inari Vermillion + Aizome Indigo + Warm Paper neutrals + Sumi Ink. Theme: light, scene "the Iwanami pocket book on a kissaten table on a quiet morning." Type: DM Sans + Noto Sans JP. Anchors: Iwanami Shoten, Are.na, iA Writer. This brief follows DESIGN.md exactly; no creative deviation in this craft pass.

## 4. Scope

- **Fidelity:** production-ready, ships and runs.
- **Breadth:** full sweep across `globals.css`, `apps/web/app/layout.tsx` (font config), and every component file that consumes renamed tokens. Estimated **~30 files** based on a grep of `bg-primary`, `bg-neutral`, `text-neutral`, `bg-success/warning/danger`, `border-neutral`, `ring-primary` across `apps/web/`.
- **Interactivity:** no new interactions; existing focus, hover, active, and disabled states preserved with new color values.
- **Time intent:** polish until it ships. Atomic. No partial migrations.

## 5. Token Organization

The new `globals.css` `@theme` block is organized in seven sections with comment headers:

1. **Fonts.** DM Sans (replacing Inter), Noto Sans JP, JetBrains Mono. Variable refs keep their existing names so loaded `next/font/google` calls map cleanly.
2. **Brand palette.** `--color-inari-vermillion`, `--color-inari-vermillion-deep`, `--color-vermillion-wash`, `--color-aizome-indigo`. Descriptive slugs.
3. **Warm paper neutrals.** `--color-warm-paper-base`, `--color-warm-paper-raised`, `--color-cream-inset`, `--color-soft-hairline`, `--color-faded-sumi`, `--color-sumi-ink`. All warm-tinted toward the brand red (chroma ~0.005–0.014 in OKLCH).
4. **JLPT spectrum (preserved).** The six `--color-jlpt-{n5,n4,n3,n2,n1,beyond}-{bg,text}` token pairs from the previous system, retained verbatim.
5. **Semantic aliases.** `--color-surface-base` to warm-paper-base, `--color-surface-raised` to warm-paper-raised, `--color-surface-inset` to cream-inset, `--color-accent` to inari-vermillion, `--color-accent-bg` to vermillion-wash, `--color-error` to `#B91C1C` (JLPT N1 Saturated Red, repurposed for form errors and due-count).
6. **Radii (preserved).** sm 6px, md 10px, lg 14px, xl 20px, full.
7. **Shadows and animations.** Shadow color migrates from `rgba(0,0,0,X)` to `rgba(70, 30, 35, X)` (warm-tinted). Focus halo migrates from `var(--color-primary-200)` to `#F8E5E5` literal. The three keyframes (`page-enter`, `card-reveal`, `otp-shake`) preserved exactly.

The previous tokens (`--color-primary-50..900`, `--color-neutral-0..900`, `--color-success/warning/danger-100/500/700`, `--color-neutral-850`) are **deleted**, not aliased. Every consumer migrates.

### Tailwind class migration table (representative)

| Old class | New class | Notes |
|---|---|---|
| `bg-primary-500` | `bg-inari-vermillion` | Primary CTA, progress bar fill, vocab badge |
| `bg-primary-600` (hover) | `bg-inari-vermillion-deep` | Primary button hover |
| `bg-accent-bg` | `bg-vermillion-wash` | Active sidebar nav |
| `text-accent`, `text-primary-500/600/700` | `text-inari-vermillion` | Brand mark, links, active nav |
| `bg-neutral-0` | `bg-warm-paper-raised` | Cards, sidebar, auth panel, mobile bar |
| `bg-neutral-50` | `bg-warm-paper-base` | Page backgrounds |
| `bg-neutral-100` | `bg-cream-inset` | Inputs, ghost-button hover, "Show Answer" bg, badges |
| `bg-neutral-200` | `bg-cream-inset` | Skeleton loaders |
| `border-neutral-200/300` | `border-soft-hairline` | Sidebar edge, mobile bar, dividers, input borders |
| `text-neutral-400` | `text-faded-sumi` | Hints, micro-labels |
| `text-neutral-500/600` | `text-faded-sumi` | Secondary text, nav default |
| `text-neutral-700` | `text-sumi-ink` | Input labels, secondary-button text |
| `text-neutral-800/900` | `text-sumi-ink` | Primary text, deck titles, headings |
| `ring-primary-200` | `ring-vermillion-wash` | Focus halos |
| `text-danger-500/600/700` | `text-error` (or `text-jlpt-n1-saturated-red`) | Form errors, due count |
| `bg-danger-500` (Again) | `bg-sumi-ink` | RatingButtons.tsx |
| `bg-warning-500` (Hard) | `bg-jlpt-beyond-amber-warn` | RatingButtons.tsx |
| `bg-success-500` (Good) | `bg-jlpt-n5-fresh-leaf` | RatingButtons.tsx |
| `bg-primary-500` (Easy in RatingButtons) | `bg-aizome-indigo` | RatingButtons.tsx |
| `font-japanese` (utility) | unchanged | Already correctly references Noto Sans JP |

### Files in scope (estimated)

- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx` (font config)
- `apps/web/app/(app)/_components/sidebar.tsx`, `mobile-bottom-bar.tsx`, `top-bar.tsx`, `offline-queue-badge.tsx`
- `apps/web/app/(app)/decks/_components/deck-card.tsx`, `deck-list.tsx`, `deck-skeleton.tsx`, `create-deck-dialog.tsx`
- `apps/web/app/(app)/decks/[id]/_components/*`, `apps/web/app/(app)/decks/browse/_components/*`
- `apps/web/app/(app)/review/session/page.tsx`, `apps/web/app/(app)/review/_components/offline-queue-banner.tsx`
- `apps/web/app/(app)/settings/_components/*`
- `apps/web/app/(app)/analytics/_components/*`
- `apps/web/app/(auth)/layout.tsx`, `login/page.tsx`, `signup/page.tsx`, `signup/verify/page.tsx`
- `apps/web/app/onboarding/_components/*`, `apps/web/app/onboarding/{level,goal,interests,decks,schedule}/page.tsx`
- `apps/web/components/ui/Button.tsx`, `Input.tsx`, `Dialog.tsx`, `OtpInput.tsx`, `Select.tsx`, `FuriganaText.tsx`
- `apps/web/components/review/ReviewCard.tsx`, `RatingButtons.tsx`, `RatingBreakdown.tsx`

## 6. Key States

- **Compile-time success.** `bun --filter web typecheck` passes; `bun --filter web build` passes; ESLint passes.
- **Runtime success.** App renders in new palette; no page shows indigo `#6366F1`. Lucide icons are still lucide (out of scope), but their stroke color inherits from the new text tokens, so they render in Faded Sumi, Sumi Ink, or Inari Vermillion as appropriate.
- **Failure mode to avoid.** A half-state where some Tailwind classes updated and some did not. Grep coverage required before declaring done.
- **Reduced-motion contract.** Untouched. `prefers-reduced-motion` continues to disable animations.
- **Dark-mode contract.** The anticipatory `--color-neutral-850` token is dropped. Light-mode-only continues.

## 7. Interaction Model

N/A. No interactions added; existing interactions preserved verbatim with the new color values.

## 8. Content Requirements

N/A. No copy changes in this PR. The auth-screen "AI-Enhanced Japanese SRS" subtitle (flagged in DESIGN.md as the canonical generic-AI-marketing line) is **not** removed here; that is a follow-up `clarify` craft.

## 9. Recommended References

- `color-and-contrast.md`: WCAG audits on Sumi Ink / Warm Paper Base, Faded Sumi / Warm Paper Base, Vermillion / Vermillion Wash, white-on-saturated rating buttons.
- `typography.md`: DM Sans loading strategy, pairing with Noto Sans JP, fallback chain.

## 10. Open Questions and Default Resolutions

1. **DM Sans loading.** Via `next/font/google`, matching the existing Inter pattern. *Default: yes.*
2. **JetBrains Mono retention.** Keep loaded as `--font-mono` even though dormant in components. *Default: yes.*
3. **`shadow-card` token color.** Migrate from `rgba(0, 0, 0, 0.08)` to `rgba(70, 30, 35, 0.07)` (warm-tinted). *Default: yes.*
4. **`--color-error` semantic alias.** Introduce as `var(--color-jlpt-n1-saturated-red)` (`#B91C1C`) so form errors and due-count text have a clean semantic class without referencing the JLPT spectrum slug directly. *Default: yes.*
5. **Type scale revision (base 0.9375rem to 1rem).** DM Sans reads slightly smaller than Inter at the same px size. DESIGN.md flags this as a possible revision. *Default for this PR: defer.* Type-scale tuning is its own follow-up pass; this craft preserves the existing scale.
6. **Drop the `warning` / `success` / `danger` semantic naming entirely?** Yes. Those names map to old indigo-system semantics. The new system uses descriptive slugs (`bg-jlpt-n5-fresh-leaf` for Good, etc.) plus the single `--color-error` alias for form-error semantics. *Default: yes.*

---

## Migration sequence (implementation plan)

The build itself proceeds in this order, atomically inside a single PR:

1. Update `apps/web/app/layout.tsx` to load DM Sans (and keep Noto Sans JP and JetBrains Mono).
2. Rewrite `apps/web/app/globals.css` `@theme` block with the seven sections above. Drop the old indigo and cool-slate tokens entirely.
3. Run a `grep -r` sweep across `apps/web/` for every old class name in the migration table; update each occurrence to its new class name.
4. Run `bun --filter web typecheck` and resolve any unresolved class names or dropped-token references.
5. Run `bun --filter web build` and confirm a clean build.
6. Open the running app at desktop, tablet, and mobile viewports; visually confirm the new palette renders end-to-end with no indigo remaining.
7. Critique-and-fix loop until no material defects remain (per craft Step 6).

Lucide icons render in their new inherited stroke color (whatever `text-faded-sumi` / `text-sumi-ink` resolves to) and are accepted as-is for this PR.
