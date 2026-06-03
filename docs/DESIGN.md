---
name: Tomo
description: Visual system spec for Tomo, the AI-enhanced FSRS app for Japanese learners. Built around a card-stack visual identity (the SRS unit as visual hero), Inari Vermillion + warm-paper neutrals + Sumi Ink, Bricolage Grotesque display + DM Sans body + Noto Sans JP, and a custom geometric ink-stroke icon set.
colors:
  inari-vermillion: "#B03646"
  inari-vermillion-deep: "#7E1F2A"
  vermillion-wash: "#F8E5E5"
  warm-paper-base: "#FBF8F4"
  warm-paper-raised: "#FDFBF7"
  cream-inset: "#F4EFE6"
  soft-hairline: "#E5DCD0"
  sumi-ink: "#1F1A18"
  faded-sumi: "#6B5F58"
  aizome-indigo: "#1B3A6B"
  jlpt-n5-fresh-leaf: "#15803D"
  jlpt-n4-deep-emerald: "#065F46"
  jlpt-n3-clear-blue: "#1D4ED8"
  jlpt-n2-deep-violet: "#6D28D9"
  jlpt-n1-saturated-red: "#B91C1C"
  jlpt-beyond-amber-warn: "#92400E"
  cool-paper-base: "#F4F1EC"
  cool-paper-shade: "#EAE6DE"
typography:
  display:
    fontFamily: "Bricolage Grotesque, DM Sans, system-ui, sans-serif"
    fontWeight: 500
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontWeight: 400
  japanese:
    fontFamily: "Noto Sans JP, Hiragino Sans, Yu Gothic, sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 400
rounded:
  xs: "2px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.inari-vermillion}"
    textColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.inari-vermillion-deep}"
  button-secondary:
    backgroundColor: "{colors.warm-paper-raised}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  button-secondary-hover:
    backgroundColor: "{colors.cream-inset}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.faded-sumi}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  button-ghost-hover:
    backgroundColor: "{colors.cream-inset}"
    textColor: "{colors.sumi-ink}"
  button-danger-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.inari-vermillion-deep}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.5rem"
  button-danger-ghost-hover:
    backgroundColor: "{colors.vermillion-wash}"
  input:
    backgroundColor: "{colors.cream-inset}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2.5rem"
  card-default:
    backgroundColor: "{colors.warm-paper-raised}"
    border: "1px solid {colors.soft-hairline}"
    topStripe: "2px solid {colors.inari-vermillion}"
    rounded: "{rounded.xs}"
    padding: "2rem"
  card-deck:
    backgroundColor: "{colors.warm-paper-raised}"
    border: "1px solid {colors.soft-hairline}"
    topStripe: "2px solid {colors.inari-vermillion}"
    rounded: "{rounded.xs}"
    padding: "1.25rem"
  card-review:
    backgroundColor: "{colors.warm-paper-raised}"
    border: "1px solid {colors.soft-hairline}"
    topStripe: "2px solid {colors.inari-vermillion}"
    rounded: "{rounded.xs}"
    padding: "2rem 3rem"
  rating-button-again:
    backgroundColor: "{colors.sumi-ink}"
    textColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.md}"
    height: "4rem"
  rating-button-hard:
    backgroundColor: "{colors.jlpt-beyond-amber-warn}"
    textColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.md}"
    height: "4rem"
  rating-button-good:
    backgroundColor: "{colors.jlpt-n5-fresh-leaf}"
    textColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.md}"
    height: "4rem"
  rating-button-easy:
    backgroundColor: "{colors.aizome-indigo}"
    textColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.md}"
    height: "4rem"
  nav-item-active:
    backgroundColor: "{colors.vermillion-wash}"
    textColor: "{colors.inari-vermillion}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "{colors.faded-sumi}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  badge-vocabulary:
    backgroundColor: "{colors.cream-inset}"
    textColor: "{colors.aizome-indigo}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-kanji:
    backgroundColor: "{colors.vermillion-wash}"
    textColor: "{colors.inari-vermillion-deep}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-mixed:
    backgroundColor: "{colors.cream-inset}"
    textColor: "{colors.faded-sumi}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
---

# Design System: Tomo

## Overview

**Creative North Star: The Card-Stack.**

Tomo is a Spaced Repetition System for Japanese, and **the card is its visual hero**. The literal SRS unit — a single card brought forward from a deck — is what the user sees on every primary surface. Auth and onboarding deliver content *on* a card, with up to two fading cards stacked behind the foreground card to make the deck visible; the stack visibly depletes as the user advances through the questionnaire. Cards are the unit; pages are the substrate beneath them.

The system rests on five committed axes:

1. **Metaphor — card-stack.** Every primary brand surface is a card resting on a tinted desk, often in front of a small stack of fading siblings. The card metaphor is structural: it's the SRS unit, not a UI motif borrowed from material design.
2. **Card anatomy.** 2px sharp corners, 1px Soft Hairline border, 2px Inari Vermillion top-edge stripe, no drop shadow. Background is Warm Paper Raised. Depth comes from cards stacked behind, not from blur or shadow.
3. **Theme — light, cool page, warm card.** The page background is Cool Paper Base (`#F4F1EC`) — a tool surface, not a paper substrate. Cards stay on Warm Paper Raised (`#FDFBF7`). The cool-vs-warm contrast reads as an object resting on a desk.
4. **Typography.** Bricolage Grotesque (variable, Google Fonts) for display; DM Sans for body and chrome; Noto Sans JP for Japanese; JetBrains Mono for SRS-data moments (intervals, retention percentages, card counts).
5. **SRS visibility.** Onboarding teaches the SRS concept by side-effect — each step's card has a left-side live preview pane that updates as the user answers. The user understands what spaced repetition does because they can see the schedule respond to their answers, not because they read an explainer.

The color strategy commits to a **Full palette**: Inari Vermillion + Sumi Ink + warm-paper neutrals + Aizome Indigo, each with a deliberate job, none overlapping. The mood is *a serious learner at a calm desk in the morning, the deck cued up, ready to begin*.

**Key Characteristics:**

- One identity color (Inari Vermillion `#B03646`), one ink color (Sumi Ink `#1F1A18`), one supporting color (Aizome Indigo `#1B3A6B`), one cool page neutral (Cool Paper Base `#F4F1EC`), and a warm-paper card surface (Warm Paper Raised `#FDFBF7`). Each has a deliberate job; none overlap.
- All neutrals are tinted toward the brand red (a faint warm cast). No `#FFFFFF`. No cool slate.
- Bricolage Grotesque for display, DM Sans for body, Noto Sans JP for Japanese, JetBrains Mono for SRS data. Latin chrome and Japanese content auto-swap families via the `[lang="ja"]` selector.
- Cards have no drop shadow at rest. Depth is conveyed by the card-stack composition, the warm-vs-cool surface contrast, and a 2px Inari Vermillion top stripe; not by elevation.
- Motion is **Responsive** by default: feedback, transitions, small reveal moments, the stroke-draw on icon hover, the route-change settle on nav. No scroll-driven choreography in product chrome; brand surfaces in active scope (auth, onboarding, OG image, milestone illustrations) may opt up to Choreographed.
- The kitsune mark is the central identity asset. It surfaces at six allowed positions per PRODUCT.md Principle #6 (wordmark, favicon, auth, OG image, app icon, milestone illustrations) and nowhere else.
- Icons are custom geometric ink-stroke SVGs (chrome and components) or Unicode glyphs at semantic value (Rating row only: ↺ ◐ ✓ ☆). The full contract lives in §Icon System.
- Borders are reserved for inputs, hairline dividers, and cards. Side-stripe borders, gradient text, and glassmorphism are universally banned.

## Colors: Vermillion on Paper

The palette commits to **Full palette** as a strategy: four named roles, each with a deliberate job, used in different proportions across product and brand registers.

### Primary

- **Inari Vermillion** (`#B03646`): the brand identity color. Used on the kitsune mark, the wordmark, the 2px card top-stripe, primary CTAs, focus rings, active states, and milestone illustrations. On product surfaces it stays under ~10% of any given screen; on brand surfaces in active scope (auth, onboarding, OG image) it can carry 30–60% of the surface as saturated solid fields. The split is the strategy.
- **Inari Vermillion Deep** (`#7E1F2A`): hover state for primary CTAs. The ink-saturated version of the brand red, used when a brand surface needs a darker variant (e.g., a saturated solid hero where the lighter vermillion would feel washed). Also the text color for the Danger Ghost button variant.
- **Vermillion Wash** (`#F8E5E5`): the lightest vermillion tint. Active-state surface for nav rows, focus-ring halo, brand-surface accent fields where a hint of color is enough.

### Secondary

- **Aizome Indigo** (`#1B3A6B`): the supporting color, drawn from traditional Japanese indigo dye (aizome). Used sparingly: for the "Easy" rating button, the vocabulary deck-type badge text, neutral/unleveled dashboard progress bars, and occasional editorial moments where a deep ink-blue carries more authority than red (long-form grammar explanations, mnemonic attribution panels, the JLPT N3 badge family). Aizome is *not* the retired Default Tech Indigo (`#6366F1`); see the Aizome Distinction Rule.

### Neutral (Cool Page + Warm Paper)

The system runs **cool page, warm card** to make cards read as objects resting on a tinted desk. The page surface is cool-tinted; card surfaces are warm-paper-tinted with a faint hue cast toward the brand red (chroma ~0.005–0.012 in OKLCH). No `#FFFFFF`. No cool slate.

**Page surface (the tool register).**

- **Cool Paper Base** (`#F4F1EC`): the page background everywhere in the app. Reads as "tool surface," not "paper substrate."
- **Cool Paper Shade** (`#EAE6DE`): a subtly darker page tint, available for sectioning the page itself (e.g., a quiet inset zone behind a card stack). Use sparingly.

**Card and component surface (the warm-paper register).**

- **Warm Paper Base** (`#FBF8F4`): legacy alias still referenced by some components; in the card-stack identity, cards live on Warm Paper Raised (below).
- **Warm Paper Raised** (`#FDFBF7`): the **card surface color**. Slightly warmer and lighter than Warm Paper Base, distinctly warmer than Cool Paper Base. Also the *text color* on saturated-fill components (Primary button, Rating buttons), where pure white would feel cold.
- **Cream Inset** (`#F4EFE6`): recessed surfaces — input backgrounds (when an input sits on a page rather than inside a card), code blocks, deck-type badge backgrounds for Vocabulary and Mixed types, and hover row tints inside chrome. Note: the sidebar and mobile drawer use Warm Paper Raised, not Cream Inset, so the navigation chrome reads as a warm panel against the cooler page rather than as a recessed inset.
- **Soft Hairline** (`#E5DCD0`): hairline borders — the 1px card border, the sidebar right edge, the answer-reveal divider, input default border, section dividers in the nav body.
- **Faded Sumi** (`#6B5F58`): the secondary text color (descriptions, hints, stats labels, Ghost button default, Furigana reading text, default-state nav-icon stroke). Hits WCAG AA against Cool Paper Base and Warm Paper Raised.
- **Sumi Ink** (`#1F1A18`): the primary text color. Deep ink-brown, not pure black. Carries the "ink on paper" character of the system. Contrast against Cool Paper Base is well into AAA. Also the background fill for the "Again" Rating button.
### Named Rules

**The Vermillion Tax Rule.** Inari Vermillion is precious on product surfaces. Every new product screen must justify each red element it introduces; the default answer to "should this be red?" is "no." Brand surfaces (auth, landing, OG, milestone illustrations) operate under a different budget: red is allowed to dominate 30–60% of the surface as a saturated solid field. The split is the strategy.

**The No-Pure-White Rule.** `#FFFFFF` is banned everywhere. Card surfaces use Warm Paper Raised (`#FDFBF7`); page surfaces use Cool Paper Base (`#F4F1EC`); the favicon plate uses `#F7F7F7` (the off-white from the brand asset, kept for parity with the existing logo file); text on saturated-fill buttons uses Warm Paper Raised (`#FDFBF7`). Pure white reads as cool-clinical-screen and breaks the ink-and-paper mood.

**The Aizome Distinction Rule.** Aizome Indigo (`#1B3A6B`) is the destination; Default Tech Indigo (`#6366F1`) is the retired trap. They are *not* interchangeable. Aizome is dark-navy-ink (low chroma at lightness ~30%); Default Tech Indigo is bright-saturated-violet (high chroma at lightness ~65%). If a surface's "indigo" reads as bright tech-violet, it is the trap; rework toward the dark navy-ink value. A quick test: aizome should look correct on a hand-dyed cotton textile; Default Tech Indigo should look correct on an enterprise SaaS landing page. They live in different worlds.

**The JLPT Spectrum Rule.** The six JLPT level badges form a fixed spectrum: N5 Fresh Leaf (`#15803D`) → N4 Deep Emerald (`#065F46`) → N3 Clear Blue (`#1D4ED8`) → N2 Deep Violet (`#6D28D9`) → N1 Saturated Red (`#B91C1C`) → Beyond JLPT Amber-Warn (`#92400E`). The spectrum is signature work; do not modify the values. Two of the spectrum colors (N5 Fresh Leaf and Beyond Amber-Warn) are also repurposed as Rating button fills (Good and Hard); see the Rating Buttons section. The cross-use is deliberate (both axes encode "difficulty level") and bounded; do not extend the JLPT spectrum to other roles.

## Typography: Bricolage Display, DM Sans Body

Two Latin families (Bricolage Grotesque for display, DM Sans for body), Noto Sans JP for Japanese, JetBrains Mono for SRS data. The display/body split lets headlines carry character while body type stays calmly readable.

**Display — Bricolage Grotesque** (Google Fonts, variable, free). Used for headlines on auth and onboarding cards, the dashboard masthead greeting, the "Welcome" register, and any large typographic moment that wants character. Bricolage is a contemporary humanist display face with subtle warmth and personality at large sizes; at small sizes it's not the right tool — that's DM Sans's job.

**Body — DM Sans** (Google Fonts, free). Used for everything else: form labels, nav labels, body copy, button text, stats rows, hints, the chrome of the app. Humanist, screen-warm, well-rendered at small sizes, pairs cleanly with Noto Sans JP across mixed-script content.

**Japanese — Noto Sans JP.** Auto-applied via the `[lang="ja"]` selector in `globals.css`. Never override with a Latin family on Japanese content; the cascade will produce wrong glyph metrics and break screen readers.

**Mono — JetBrains Mono.** Reserved for SRS-data moments — intervals (`5d`, `2w`), retention percentages (`87%`), card counts (`24/180`), review milliseconds in dev tools, and any monospace context. Mono shouldn't appear in chrome by reflex; reach for it when the data benefits from tabular alignment.

### Hierarchy

The committed type scale is in `globals.css` (`--text-xs` through `--text-5xl`, with v4-namespaced line-height tokens), plus display-figure tokens (`--text-numeral`, `--text-glyph`) and the responsive role utilities (`.text-section` / `.text-title` / `.text-display` / `.text-hero` / `.text-stat`). The roles map as:

- **Display** (`--text-3xl` → `--text-5xl`, Bricolage Grotesque): hero word on the review card, dashboard masthead lines, auth/onboarding card titles, milestone illustrations.
- **Headline** (`--text-2xl`, Bricolage or DM Sans semibold): major page-section headings.
- **Title** (`--text-xl`, DM Sans semibold): section titles, modal headers, deck-card titles.
- **Body** (`--text-base`, DM Sans regular): default reading text — sentences, mnemonics, grammar explanations.
- **Body Small** (`--text-sm`, DM Sans): nav labels, stats rows, hints.
- **Label** (`--text-xs uppercase tracking-[0.08em]`, DM Sans medium): section labels in the nav, badges, fieldset legends, keyboard-shortcut chips.
- **Stat figure** (`.text-stat`, responsive 1.625rem → 1.875rem, tabular numerals): the large figures in review-summary / setup / insights stat tiles. The oversized empty-state numeral uses `--text-numeral` (1.75rem); aria-hidden background ornaments use `--text-glyph` (3.75rem).

The minimum scale ratio between hierarchy steps is 1.25; the gap between Body and Display lands closer to 2.5–3× to give Japanese content room to be the loudest thing on the page.

### Named Rules

**The Two-Family Rule.** Two Latin families, no more: **Bricolage Grotesque** for display, **DM Sans** for body and chrome. Adding a third family (a serif, an editorial display, a script) is rejected. The character contrast that a third family might carry is provided by the display/body split itself, by weight variation within DM Sans, and by Bricolage's variable axes. Mincho serifs (DM Serif Display, Noto Serif JP) are explicitly retired — the previous "editorial-serif at the top of the page" pattern is not the system.

**The Lang-Attr Rule.** Japanese content must always be wrapped in an element with `lang="ja"`, which automatically swaps the font stack to Noto Sans JP. Never override the font family on Japanese content with a Latin family. Never use a Latin family on a parent that contains Japanese children — the cascade will produce mojibake-quality glyph rendering.

**The Furigana Rule.** Furigana renders only through the `<FuriganaText>` component (semantic `<ruby>`/`<rt>` markup). Visual approximations (positioned spans, vertical-align hacks, decorative SVG) are forbidden because they break screen-reader pronunciation.

**The Hand-Calligraphic Exception.** The wordmark and the kanji rendered inside the kitsune logo are hand-brushed (not typeset). They are not subject to the Two-Family Rule because they are *images*, not text. Brush-style display fonts and bespoke calligraphy are permitted in identity surfaces only (the wordmark, the favicon, the auth screen, the OG image, milestone illustrations) and must never appear in body or chrome typography.

**The Body-Reading Rule.** Cap body line length at 65–75 characters per line for readability (per the shared design laws). On long-form learning surfaces (grammar explanations, mnemonic readouts), enforce this with `max-width: 70ch` or similar; on dense product surfaces (deck list, settings), the rule applies less strictly because content lines are typically short by composition.

**The SRS-Data-Mono Rule.** Numeric SRS data — intervals, retention percentages, due-card counts, review-time milliseconds — renders in JetBrains Mono so columns of numbers align and individual digits read with equal weight. Prose containing SRS numbers stays in DM Sans; only the data itself drops to mono.

## Elevation: Cool Page, Warm Card, Quiet Shadow

Tomo's cards are **not elevated by shadow**. Depth comes from the cool-vs-warm surface contrast (a warm-paper card on a cool-paper page reads as an object resting on a desk), the 1px Soft Hairline border, the 2px Inari Vermillion top stripe, and — on auth and onboarding — the visible stack of fading sibling cards behind the foreground card.

Shadow is reserved for **state and overlay**, never for ambient decoration. There are exactly five moments shadow appears.

### Shadow Vocabulary

- **Focus Ring** (`--shadow-focus`): 3px Vermillion Wash halo on `:focus-visible`. The keyboard navigation indicator. Brand surfaces may use a stronger ring at full Inari Vermillion.
- **Popover Lift Shadow** (`--shadow-card`): warm-tinted soft shadow on overlays that detach from the page — the UserMenu account popover, dropdown menus, hover cards. Approximately `0 4px 12px rgba(70, 30, 35, 0.07)`.
- **Modal Lift Shadow** (`--shadow-lg`): stronger warm-tinted shadow for modal dialogs (delete-account confirmation, error dialogs, and approved modal tools). Approximately `0 8px 24px rgba(70, 30, 35, 0.10)`.
- **Soft Hairline Shadow** (`--shadow-sm`): the lightest possible separation, reserved for moments of hint-of-lift only — currently dormant in the system; available when needed.
- **Pressed Shadow** (`--shadow-pressed`): inset `inset 0 1px 2px rgba(31, 26, 24, 0.12)` on the active/pressed state of filled buttons and controls — "the press is felt as ink, not movement." Two variants: `--shadow-pressed-strong` (0.22 alpha) for slider thumbs, and `--shadow-pressed-inverse` (warm-paper at 0.10 alpha) for dark Sumi Ink surfaces.

Cards (the SRS unit, deck cards in lists, the review card, the auth/onboarding card) use **none** of these at rest. They are flat objects with a 1px Soft Hairline border and a 2px Inari Vermillion top stripe. Hover, when it exists, never adds shadow to a card.

### Named Rules

**The Flat-Card Rule.** Cards are flat at rest. The card-stack identity uses border + top stripe + the cool-vs-warm surface contrast for depth, never drop shadow. A card with `box-shadow` at rest is wrong; remove the shadow and let the card-stack composition (or the lone card on cool paper) do the work.

**The State-Only Shadow Rule.** Shadows respond to *state* (focus, popover open, modal presented), not to decoration. Buttons, badges, nav items, and cards are all part of the resting plane until they're triggered. There is no "ambient elevation tier"; surfaces are either flat or actively presenting.

**The Warm-Tint Shadow Rule.** When shadow does appear, its color carries a faint warm cast that matches the warm-paper neutrals. A pure-neutral-black shadow on warm paper looks gray and cold; a warm-tinted shadow harmonizes. Practical implementation: shadow color uses OKLCH (or `rgba(70, 30, 35, X)` as a literal approximation) toward hue ~25, the same hue family as the warm-paper neutrals — never `rgba(0,0,0,X)`.

**The Opaque-Chrome Rule.** Sticky and floating chrome surfaces (mobile sticky action bar, dev panels, toast notifications) commit to fully opaque `bg-warm-paper-raised` rather than translucency-plus-blur. Glass effects (`backdrop-blur-*` plus reduced opacity) are explicitly off-pattern for chrome: warm-paper against the cool page already provides sufficient visual separation via the 1px soft-hairline border and the warm/cool surface contrast. **Modal backdrop carve-out:** the native `<dialog>` element's `::backdrop` pseudo-element (see `apps/web/components/ui/Dialog.tsx`) may pair `bg-sumi-ink/40` with up to `backdrop-blur-[2px]` to deepen the modal stage by softening the page underneath. The blur lives on the page-dimming scrim only; the dialog body itself stays opaque `bg-warm-paper-raised` per the chrome rule above. This is the single documented exception — any other surface that wants blur would need its own explicit carve-out here.

### Stacking Order

Z-index is a single ordered ladder defined in `globals.css` `:root` (Tailwind v4 has no
z-index theme namespace) and consumed via `z-[var(--z-*)]`. Surfaces never hand-pick a number.

| Token | Value | Layer |
|---|---|---|
| `--z-sticky` | 10 | sticky headers / rails |
| `--z-raised` | 20 | sticky action bars |
| `--z-bar` | 30 | fixed bottom rating / action bars, undo pills |
| `--z-nav` | 40 | session top bar, mobile-drawer scrim |
| `--z-overlay` | 50 | full-screen takeovers, drawer panel |
| `--z-popover` | 60 | dropdowns, menus, popovers, sheets — above overlays |
| `--z-toast` | 70 | toasts — above everything |

**The Stacking-Ladder Rule.** Popovers and dropdowns sit above the overlays that launch them
(`--z-popover` > `--z-overlay`), and toasts sit above both — a toast must never be occluded by
the surface that triggered it. Local, in-component stacking (`relative z-[1]`, a stripe painted
over card content) is deliberately *not* on this ladder; it only competes with its own siblings.
Never introduce an ad-hoc `z-[55]` to escalate above a tier — add to or reuse the ladder instead.

## Components

The component library below is **prescribed**, not described. The current code in `apps/web/components/` and the chrome under `apps/web/app/(app)/_components/` differs from this section. Implementation must migrate to the spec below; afterward, run `$impeccable document` to verify the spec landed and to regenerate the `.impeccable/design.json` sidecar with shadow-DOM-renderable HTML/CSS for the live panel.

### Buttons

The button is **a block of color resting on warm paper**. It is not a glossy clickable thing; it is the page's voice acting on a control. Five variants (Primary, Secondary, Editorial, Ghost, Danger), three sizes (sm, md, lg). Plus an `iconOnly` shape axis for square icon buttons.

- **Shape:** 2px radius (`rounded-xs`, the `--radius-xs` token), uniform across variants and sizes. Cut-paper feel; not a soft pill. Matches the card's 2px corner so a button-inside-a-card composition reads as a single visual register.
- **Sizes:** sm (`h-8 px-3 text-sm`), md (`h-10 px-4 text-sm`, default), lg (`h-12 px-5 text-base`).
- **Primary:** Inari Vermillion (`#B03646`) background, Warm Paper Raised (`#FDFBF7`) text. Hovers to Inari Vermillion Deep (`#7E1F2A`). Reserved for the single most important action on a screen, never used twice in the same view.
- **Secondary:** Warm Paper Raised (`#FDFBF7`) background, Sumi Ink (`#1F1A18`) text, 1px Soft Hairline (`#E5DCD0`) border. Hovers to Cream Inset (`#F4EFE6`) background, border darkens to Faded Sumi.
- **Editorial:** Transparent background, Sumi Ink text, 1px Soft Hairline border. Same hover as Secondary (`bg-cream-inset`, border-faded-sumi). Used for chrome-fit affordances where the form-half background should show through.
- **Ghost:** Transparent background, Faded Sumi text, no border. Hovers to Cream Inset background, Sumi Ink text.
- **Danger:** Sumi Ink (`#1F1A18`) background, Warm Paper Raised text. Hovers to a deeper sumi (`#0E0A09`). The hue swap to charcoal makes destructive visually unmistakable from Primary vermillion. Requires a `leadingIcon` prop (default: hairline-X-in-circle seal-mark).
- **Focus:** Non-danger variants use 1px Sumi Ink outline at `outline-offset-2` on `:focus-visible`. Danger uses Warm Paper Raised outline at the same offset (so the line reads against the dark fill). Buttons use a tighter outline rather than the 3px Vermillion Wash halo; the halo is reserved for chrome elements (nav rows, inputs) where it doesn't compete with the button's own background.
- **Active state:** Filled variants (Primary, Danger) get the `--shadow-pressed` inset shadow (`inset 0 1px 2px rgba(31, 26, 24, 0.12)`) and a deeper bg, no scale transform. The press is felt as ink, not as movement.
- **Disabled:** Opacity 0.6, `cursor-not-allowed`, pointer-events disabled.
- **Loading:** Three sumi-ink dots (`bg-current` so they match each variant's text color) pulse in a centered overlay; the children sit at `opacity-0` so width is preserved. Animation `--animate-button-dot-pulse` (1400ms ease-in-out infinite, staggered 0/200/400ms per dot).

### Inputs

The input is **a recessed surface inside the card**. The Cream Inset background makes it read as cut into the card's warm-paper plane rather than floating above it.

- **Style:** Three sizes (sm `h-8 px-2.5 text-sm`, md `h-10 px-3 text-sm` default, lg `h-12 px-4 text-base`), Cream Inset (`#F4EFE6`) background, 1px Soft Hairline (`#E5DCD0`) border, 2px radius (`rounded-xs`, the `--radius-xs` token), Sumi Ink (`#1F1A18`) text.
- **Placeholder:** Faded Sumi (`#6B5F58`) at the same weight (no italic, no extra styling).
- **Focus:** 1px Sumi Ink outline at `outline-offset-2` (matches Button's focus pattern). Border stays Soft Hairline.
- **Error:** Border shifts to JLPT N1 Saturated Red (`#B91C1C`); error outline shifts to error-deep on focus; error message renders below at `text-sm` (not `text-xs`) in error red with a leading 12×12 hairline-X-in-circle glyph and `role="alert"`. Field-level errors via the `error` prop (used for "invalid credentials" → password field by convention).
- **Disabled:** Opacity 0.6, `cursor-not-allowed`, pointer-events disabled.
- **Read-only:** `border-transparent bg-transparent` — reads as plain card text, not a disabled control.
- **Label:** `text-xs uppercase tracking-[0.08em] text-faded-sumi font-medium` (small-caps fieldset legend register), 0.375rem gap between label and input. Hint and error are `text-sm`.
- **Slots:** `leadingNode` and `trailingNode` accept `ReactNode` for icons / units / actions. Padding adjusts to clear the slot. When `type="password"` and no `trailingNode` is provided, a default Show/Hide *text* affordance renders in the trailing slot (per the Lucide Tax Rule — never an eye icon).
- **Japanese awareness:** `script` prop (`'latin' | 'kana' | 'kanji' | 'mixed'`) sets `lang`, `font-family` (`font-japanese` for non-latin), and letter-spacing (kana gets a slightly looser 0.025em tracking). The `lang` HTML attribute can also be passed directly; it wins for accessibility-bound behavior.

### Cards (Generic)

The card is the **visual hero of the system** — the SRS unit given weight and presence. Every card across the app shares one anatomy.

- **Corner Style:** 2px radius (`rounded-xs`, the `--radius-xs` token). Sharp, cut-paper feel; not a soft pill.
- **Background:** Warm Paper Raised (`#FDFBF7`). Distinctly warmer than the Cool Paper Base page beneath, so the card reads as an object on a desk.
- **Border:** 1px Soft Hairline (`#E5DCD0`) on the left, right, and bottom edges. The top edge is replaced by the top-stripe (below).
- **Top Stripe:** 2px solid Inari Vermillion (`#B03646`) running flush with the top edge of the card. The brand identity device. Implemented as an absolutely-positioned span with negative offsets so it reaches the rounded corners cleanly; `overflow-hidden` on the card root clips the stripe to the 2px radius.
- **Shadow:** None at rest. Per the Flat-Card Rule, cards are flat objects; depth is conveyed by the warm-vs-cool surface contrast and (on auth/onboarding) by the visible stack of fading sibling cards behind.
- **Internal Padding:** `2rem` (default content cards) or `2rem 3rem` (Review Card, when the card needs more horizontal breathing room around the focal Japanese word) at desktop sizes; tighter at small viewports.
- **Hover behavior:** None on the card itself. Cards do not lift, scale, or change color on hover; interactions live in the child elements (buttons, links) that occupy them.

#### Variants

The `<Card>` primitive in `apps/web/components/ui/Card.tsx` ships three variants that share this anatomy:

- **`default`**: full-size card with generous internal padding (`p-8 md:p-10`). Used on auth, onboarding, and any standalone-card surface.
- **`compact`**: tighter padding (`p-6`). Used inside denser layouts — the signup form's per-section grouping, settings sub-panels.
- **`surface`**: nested surface inside a parent card. No top stripe, lighter `border-soft-hairline/60`, Cream Inset background. Used for the example-sentence panel inside the Review Card and similar nested-content moments. The lack of stripe prevents two parallel red stripes inside one composition (which would read as competing identity devices).

#### The card-stack composition

On auth and onboarding, the foreground card sits in front of up to **two fading cards stacked behind**, offset by ~6–10px each, opacity stepping down from 100% → ~60% → ~30%. The stack visibly depletes as the user advances through onboarding (each completed step removes one card from the rear of the stack). This is the brand register's signature; product surfaces (dashboard, decks, analytics) typically show a single card or a list of cards, not a depleting stack.

### Dashboard Surface

The dashboard is the learner's morning desk, not a stats wall. It opens with a wide masthead that uses `/assets/dashboard/hero-garden-background.png`: a quiet study-desk image with the active objects biased to the right and low-detail paper texture under the greeting. The image is masked into Cool Paper Base and should never sit inside a card.

- **Masthead:** learner-local date and greeting come from profile timezone. The copy may acknowledge yesterday or skipped days, but never uses streak pressure. The visible date block is a compact calendar object, not a leaderboard.
- **Primary review hero:** the due queue remains the first interactive product object after the masthead. It is driven by `GET /api/v1/reviews/due` plus deck metadata and splits the route into new, review, and backlog counts.
- **Forecast module:** the chart shows backlog, scheduled reviews, and actual new-card inventory as stacked segments. Mobile/tablet shows seven days; desktop shows fourteen. Future days can fade by distance, but labels and segment colors must stay legible.
- **Active decks:** the shelf uses real deck names and card counts plus per-deck due/new/review/mature/last-reviewed rollups (served by `list_decks_paginated`); missing rollups render as quieter metadata, never fake progress.
- **Weak spots and recent activity:** recent activity is derived from heatmap data. Weak spots are served by the weak-spot list API (`GET /api/v1/weak-spots`) and surface on Today as a calm pre-session signal.
- **Practice signal:** the pre-session note is served by the Tomo daily-note API (`GET /api/v1/tomo/note`), distilled into the hero as one calm prose line — shown only on calm days (when no unresolved weak spots claim the slot). Tomo never speaks in normal review chrome (PRODUCT.md Principle #6).
- **Dev-only preview controls:** dashboard preview controls are available only through the development launcher. They may use sample data to exercise loading, empty, error, unavailable, and high-volume states; no preview affordance ships in production.

Streak UI is deferred to a later product version. Do not reintroduce streak hero numbers, streak beads, or streak-pressure copy into the current dashboard.

### Deck Card (List-Row)

A specialization of the generic Card primitive used in the deck-list grid. Inherits the Card anatomy (2px corner, 1px Soft Hairline border, 2px Inari Vermillion top stripe, no shadow) and adds list-row-specific content. Applies the page-enter animation with a 50ms stagger by index when the list mounts.

- **Internal padding:** `1.25rem` (tighter than the default content-card padding to fit list density).
- **Header row:** Deck title in Body (`font-semibold`, Sumi Ink) on the left, deck-type pill on the right, options-button ghost trailing.
- **Deck-type pill:** rounded-full, `px-2 py-0.5`, `text-xs font-medium`. Vocabulary uses Aizome Indigo (`#1B3A6B`) text on Cream Inset (`#F4EFE6`) background; Kanji uses Inari Vermillion Deep (`#7E1F2A`) text on Vermillion Wash (`#F8E5E5`) background; Mixed uses Faded Sumi text on Cream Inset background.
- **Description:** Body Small, Faded Sumi, single-line truncate.
- **Stats row:** `text-xs`, Faded Sumi for normal counts; the due count, when greater than zero, shifts to JLPT N1 Saturated Red (`#B91C1C`) with `font-medium` to read as gentle urgency (not alarm).
- **Progress bar:** `h-1` track at Cream Inset, fill at Inari Vermillion. Width transitions on data change. The bar is the one acceptable place for full-saturation Vermillion at a small surface area, since the visual mass is tiny (1px tall).

### Review Card (Signature)

The defining surface of the app — **the single SRS card brought forward from the deck**. Focal Japanese word centered, supporting chrome restrained, the answer revealed below an answer-divider. Inherits the Card anatomy (2px corner, 1px Soft Hairline border, 2px Inari Vermillion top stripe, no shadow). Max-width 640px; centered horizontally on the page.

- **Internal padding:** `2rem 3rem` so the focal Japanese word has horizontal breathing room.
- **Top chrome:** `text-xs` card-layout pill (Vocabulary / Grammar / Sentence — the `layout_type`) at top-left, Faded Sumi text on Cream Inset background, rounded-full, padded `px-2.5 py-0.5`.
- **Focus zone:** Display size (final scale to be set at implementation; ≥3rem suggested), Noto Sans JP, `font-medium`, Sumi Ink, centered. Padding `pt-8 pb-8 px-12` around the word.
- **Pre-reveal control:** "Show Answer" Ghost Button (NOT a Primary button). Below the button, a `text-xs` Faded Sumi hint reads "or press Space."
- **Answer reveal:** Triggers the `card-reveal` keyframe (250ms fade-in plus -8px translate). Reveals a `border-t` of Soft Hairline followed by, in order: the FuriganaText (kanji + reading), the English meaning in Body, and (if available) an example sentence in a nested Cream Inset surface (Japanese with furigana on top, English translation in Faded Sumi below).
- **Distinctive behavior:** The mid-review "Show Answer" button is intentionally Ghost-quiet so the Rating buttons that follow can be the loudest moment of the screen. Per the Show-Answer Quiet Rule.

### Rating Buttons (Signature, FSRS-specific)

The four-button row that captures the FSRS rating after answer reveal. The most semantically loaded UI on the screen: each tap rewrites the schedule. The new system uses **four redundant signaling channels** so it remains accessible even when color cannot carry the load.

- **Layout:** `grid grid-cols-4 gap-3 max-w-[640px]` matching the Review Card width.
- **Each button:** `h-16` (4rem), 10px radius, flex-column with three lines: glyph (top), label (middle), key hint (bottom at 70% opacity).
- **Color and glyph mapping (the four channels: color, glyph, label, keyboard number):**

| Rating | Background | Text | Glyph | Label | Key | Reads as |
|---|---|---|---|---|---|---|
| Again | Sumi Ink (`#1F1A18`) | Warm Paper Raised | ↺ rewind / hand-drawn curl-arrow | Again | 1 | *Go back to the start.* |
| Hard | JLPT Beyond Amber-Warn (`#92400E`) | Warm Paper Raised | ◐ half-shaded circle | Hard | 2 | *More effort needed.* |
| Good | JLPT N5 Fresh Leaf (`#15803D`) | Warm Paper Raised | ✓ check mark | Good | 3 | *Got it.* |
| Easy | Aizome Indigo (`#1B3A6B`) | Warm Paper Raised | ☆ outlined star | Easy | 4 | *Knew it cold.* |

- **Hover:** Each button's background shifts approximately 10% darker in OKLCH lightness (same hue / chroma); label opacity stays full.
- **Focus:** 2px Warm Paper Raised inner ring + 4px outer ring in the button's own color, providing visible focus on any background.
- **Color-blind safety:** With four redundant channels (color + glyph + label + key), the rating row works for deuteranopia and protanopia users. The OKLCH lightness sweep across the four backgrounds (Sumi Ink darkest → Beyond Amber → N5 Fresh Leaf → Aizome Indigo, each at distinct lightness) means the row also reads as a tonal gradient when hue is unavailable. Glyphs are mandatory; never ship a "color-only" rating row again.

### Navigation

Two surfaces — the desktop **Sidebar** (lg+) and the **MobileDrawer** (< lg) — share a vocabulary and differ only in container shape.

Single kanji glyphs as navigation icons (a historical proposal of 家 / 本 / 復 / 統 / 設) are not part of the system. Navigation uses the **custom geometric ink-stroke icon set** defined in §Icon System.

- **Sidebar (desktop, lg+):** 288px (`w-72`) fixed-width column, **Warm Paper Raised** (`#FDFBF7`) background, 1px Soft Hairline right border, full screen height. The page beneath the chrome uses **Cool Paper Base** (`#F4F1EC`) so the sidebar reads as a warm panel resting on a cooler desk surface — the same warm/cool composition that gives cards their object-on-desk feel, extended to the navigation chrome. The header strip carries the brand `<Logo>` (kitsune mark + Tomo wordmark) at the committed sizing, with a 1px Soft Hairline bottom border. Nav items are pill-rows at 10px radius, padded `px-3 py-2`, with a `0.75rem` gap between icon and label.
- **MobileDrawer (< lg):** Slide-in left panel, 85vw / max-320px wide, same Warm Paper Raised background, no right border. Backdrop is Sumi Ink at 40% opacity. The drawer header mirrors the sidebar's brand strip, plus a close button (×) at the right. The nav body is identical to the sidebar's; the structure carries through the breakpoint without re-imagining.
- **Section grouping (both surfaces):** Three sections in fixed order — **Study** (Reviews, Weak spots), **Library** (Decks, Premade decks, Cards), **Insights** (Overview, Progress, Forecast, Statistics). Section labels render as `text-xs uppercase tracking-[0.08em] font-semibold` in Faded Sumi. Non-first sections are preceded by a 1px Soft Hairline divider (`mx-3 h-px bg-soft-hairline`) for editorial punctuation.
- **Icons:** custom geometric ink-stroke SVGs from `apps/web/components/icons/`. Nav rows use IconReviews, IconWeakSpots, IconDecks, IconBrowse (premade), IconCards, IconOverview, IconProgress, IconForecast, IconStatistics; the account menu uses IconProfile / IconSettings / IconReportBug / IconSignOut. Sized at 24px in nav rows, 16px in the account popover. Color is `currentColor` so the icon inherits the row's text color.
- **Default state:** Sumi Ink label, Faded Sumi 1.75px-stroke icon, transparent row background.
- **Hover:** Cream Inset row tint fades in (200ms ease-out, 50ms delay so the icon leads). Icon color transitions from Faded Sumi → Sumi Ink via inherited `currentColor` (200ms ease-out, no delay). Per the Static Icon Rule in §Icon System, the icon itself never animates — only its inherited color changes.
- **Active (current page):** Vermillion Wash (`#F8E5E5`) row background, Inari Vermillion (`#B03646`) icon and label, label weight bumps to semibold. The previous full-saturation `bg-inari-vermillion` fill (in current `nav-item.tsx`) is retired; that pattern violated the Vermillion Tax Rule for product chrome.
- **Active route-change settle:** on mount, the newly-active row plays a one-shot settle: row wash fades in (250ms), icon stroke draws (300ms with 50ms delay so the row leads), label color transitions in (200ms). One-shot only; no looping.
- **Focus (keyboard):** 3px Vermillion Wash halo via `--shadow-focus`; row treatment unchanged.
- **Sub-nav (expandable parent rows, when used):** the caret button is a separate hit target from the link; rotates 90° on expand (200ms ease-out). Child rows reveal via `grid-template-rows` transition (250ms ease-out). Children don't render an icon at level 1; they indent to align under the parent's label. (The current nav is flat — Premade decks is a top-level Library row, not a Decks sub-nav.)
- **Account strip (bottom, both surfaces):** UserMenu component with avatar disc (Vermillion Wash bg, Inari Vermillion text initial) + display name + chevron. Tap opens a popover with Profile / Settings / Report a bug / Sign out, each prefaced by an ink-stroke icon at 16px.
- **Implementation note:** the icon set must be kept in sync between the Sidebar nav rows, the MobileDrawer nav rows, and the UserMenu popover items. A new top-level destination requires a new icon component in `apps/web/components/icons/` plus an entry in `apps/web/app/(app)/_components/nav-config.ts`. The nav-config's previous `glyph: string` field is replaced by `icon: ComponentType<IconProps>` referencing the imported icon component.

### Furigana Text (Signature Primitive)

The semantic ruby/rt component, preserved end-to-end with one tonal adjustment.

- **Markup:** `<ruby lang="ja">{text}<rt>{reading}</rt></ruby>` rendered through the `<FuriganaText>` component.
- **Ruby (kanji body):** Noto Sans JP, font size matches context (Display, Body, etc.), Sumi Ink color.
- **Rt (reading hint):** Noto Sans JP, 0.4em (40% of parent size), font-weight 400, **Faded Sumi (`#6B5F58`)** color. The reading is visibly subordinate to the kanji body so the kanji remains the primary focus — supporting cast, not co-lead.
- **Accessibility:** `<ruby>` is read with the kanji and reading combined; screen readers handle the pronunciation correctly. Visual approximations (positioned spans, vertical-align hacks, decorative SVG) are forbidden because they break this contract.

### Named Rules

**The Single-Primary Rule.** A given screen has at most one Primary button visible at any moment. If the design needs two, one of them is the wrong variant; downgrade to Secondary, Ghost, or Danger Ghost. The Vermillion Tax Rule (see §Colors) forbids spending the brand red twice on a single product surface.

**The Lucide Tax Rule.** See §Icon System → Named Rules for the current authoritative version. Summary: lucide-react is retired; new icon work uses the custom geometric ink-stroke set (everywhere in chrome and components) or Unicode glyphs at semantic value (Rating row only). No new lucide imports may land.

**The Show-Answer Quiet Rule.** The mid-review "Show Answer" affordance is a Ghost button, not a Primary. The four Rating buttons that follow are the loudest moment of the screen; the reveal control must not compete.

**The Geometric Ink-Stroke Rule.** See §Icon System → Named Rules for the authoritative version. Summary: navigation icons (and all chrome/component icons) are custom geometric ink-stroke SVGs from `apps/web/components/icons/`, drawn to the contract in §Icon System.

**The Four-Channel Rating Rule.** Rating buttons (FSRS Again / Hard / Good / Easy) ship four redundant signaling channels: background color, glyph icon, label text, and keyboard number. A button missing any channel is incomplete. Never ship a color-only rating row; color alone fails deuteranopia and protanopia users.

**The Danger Ghost Rule.** Filled red Danger buttons are not used in Tomo. Destructive actions use the Danger Ghost variant (transparent + Inari Vermillion Deep text), or — when the destructive action has already been confirmed (e.g., the user typed DELETE in a confirmation input) — the standard Sumi-Ink Danger variant takes over. Filled vermillion never marks destructive intent.

## Icon System

The Tomo icon system is one coherent family across two co-existing collections that share construction grammar:

1. **Onboarding marks** (existing): `apps/web/components/icons/study-marks.tsx`, `apps/web/components/icons/dashboard-marks.tsx`, `apps/web/components/icons/arrow-glyph.tsx`. These cover the SRS-tool register: ToriiGate, BookOpen, Briefcase, the Pace glasses, CheckMark, DrillMark, CramMark, ArrowGlyph.
2. **Chrome marks** (canonical, brand-aligned): `apps/web/components/icons/chrome-marks.tsx`. The `CHROME_MARKS` showcase array catalogues fifty icons covering nav, account menu, status row, drawer, topbar, and the major action/edit/data/feedback/progress/language/utility affordances; the file additionally exports the post-rename nav icons (IconReviews, IconWeakSpots, IconCards, IconOverview, IconProgress, IconForecast, IconStatistics) that the live nav uses but that are not yet registered in the array.

Both collections render at the same construction discipline; chrome-marks additionally bakes Tomo's signature brand devices (the card top-stripe, hi-no-maru focal disc, kanji-stroke weight rhythm, tategaki text) into the shapes themselves.

### Construction Grammar

Non-negotiable across every icon in `chrome-marks.tsx`:

- **viewBox:** `"0 0 40 40"` (40 design units square). All path coordinates are in this space.
- **Primary stroke (`STROKE`):** `1.25`. Defined as a module constant; every primary outlined path uses `strokeWidth={STROKE}`.
- **Linecap:** `"round"`. All open paths terminate in rounded caps.
- **Linejoin:** `"round"`. All path corners are rounded (no miter spikes at acute angles).
- **Fill:** `"none"` on outlined paths.
- **Stroke color:** `"currentColor"` on outlined paths. Never a hard-coded color value.
- **Filled focal elements:** `fill="currentColor" stroke="none"`. Used for hi-no-maru discs, kanji-stroke dots, the Tomo top-stripe band, mizuhiki knot jewel, and similar small filled accents.
- **Secondary detail lines (interior text suggestions, page hints):** `strokeWidth={STROKE * 0.5}` to `{STROKE * 0.6}`, `opacity="0.65"` (sometimes `0.6`). Used for tategaki text on cards, page text lines in the dictionary, content strokes in flag/dictionary/notification tanzaku.
- **Kanji-stroke emphasis:** selected paths use `strokeWidth={STROKE * 1.1}` to `{STROKE * 1.5}` for "heavier strokes" that mimic kanji-radical weight contrast within a single mark. Used on Play/Skip triangles, Pause bars, Help question-mark curve, Cross X, Warning triangle outline, Star, Streak flame, Microphone capsule, Speaker cone, Plus vertical bar, Cross/Check, etc.
- **The COMMON_PROPS spread:** every outlined path applies the construction defaults via `{...COMMON_PROPS}` where:

```ts
const STROKE = 1.25
const COMMON_PROPS = {
  fill:           'none',
  stroke:         'currentColor',
  strokeWidth:    STROKE,
  strokeLinecap:  'round',
  strokeLinejoin: 'round',
} as const
```

- **SVG opener pattern (every icon):**

```tsx
<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
  {/* paths */}
</svg>
```

`width="40" height="40"` are SVG attribute defaults; the rendered display size is controlled by Tailwind classes on the `<svg>` (e.g., `w-6 h-6` for 24px, `h-10 w-10` for 40px). `aria-hidden="true"` is mandatory because icons are decorative — semantic labeling lives in the surrounding text.

- **Path budget:** at most 4-6 elements per icon. Most ship 2-4. The budget is a discipline, not a hard limit; if an icon requires more elements to read correctly, the design is wrong before the budget is wrong.

### Brand-alignment devices

Five signature devices distinguish chrome-marks from generic icon libraries and tie the icons to Tomo's product surfaces:

1. **Tomo card top-stripe.** A filled rectangle 2.5 design units tall at the top of card-bodied icons. Renders Vermillion at active state via inherited `currentColor`. This is the literal visual device used on actual card surfaces in `apps/web/components/ui/Card.tsx`; the icons reference it self-referentially. Used in: Review, Decks, AddCard, Save, Copy, Calendar (Calendar uses a 6-unit-tall version as a header band).

2. **Hi-no-maru focal disc.** A filled circle (typically `r=3` to `r=3.2`) at a focal point in the icon. References the Inari sun disc behind the kitsune in the brand mark. Filled `currentColor` so it inherits the row's tier color. Used in: Dashboard (top-left cell), Browse (middle drawer handle, larger r=1.4), Analytics (behind central peak), Search (lens center), Info (top dot), Target (bullseye center).

3. **Kanji-stroke weight rhythm.** Selected paths within a single icon use stroke weights heavier than `STROKE`, evoking the brush-pressure contrast in kanji-radical strokes. The rhythm is 1.0× to 1.5× variation. Used in: Play, Pause, Skip, Cross, Warning, Info disc, Hamburger middle line (lighter), Plus vertical, Help question-mark curve, Star outline, Streak flame, Trophy cup, Microphone capsule, Speaker cone, Dictionary spine.

4. **Tategaki vertical text suggestion.** Thin opacity-0.65 lines running vertically inside card-bodied icons, representing Japanese reading direction. 3 lines, varying lengths (long, medium, slightly shorter), at coordinates following the card's interior. Used in: Review, Decks, AddCard, Report a bug (also inside speech bubble), Flag (inside nobori banner), Dictionary (page hint lines).

5. **Cultural-form references baked into shapes.** Selected icons take their primary form from a Japanese cultural object rather than a Western convention. The references are subtle (one per icon, not multiple) and serve the metaphor:
   - **Dashboard** = 田 (rice paddy) kanji + hi-no-maru disc.
   - **Browse** = tansu (chest of drawers).
   - **Analytics** = sangaku (三角, three mountain peaks).
   - **Profile** = person with kimono V-collar at chest.
   - **Settings** = mizuhiki (decorative cord) butterfly bow knot.
   - **Sign out** = torii (shrine gate) with shimenawa rope drape.
   - **Notifications** = fūrin (wind chime) with tanzaku paper strip.
   - **Offline** = stylized kasumi (traditional cloud) silhouette.
   - **Search** = magnifier with hi-no-maru lens.
   - **Edit** = fude (calligraphy brush) with bamboo cap.
   - **Save** = bookmark with Tomo top-stripe.
   - **Tag** = omamori (charm bag) shape with cord knot at top.
   - **Sort** = three ofuda (paper amulet strips), decreasing width.
   - **Streak** = flame with kanji 火 (fire) inner stroke.
   - **Trophy** = rice bowl with curved Asian-style handles.
   - **Target** = hi-no-maru disc + concentric rings.
   - **Translate** = serif A + kana あ + brushstroke arrow.
   - **Dictionary** = wahon (Japanese bound book) with calligraphic spine.
   - **Lightbulb** = chochin (paper lantern) with horizontal bamboo bands.
   - **Plus** = 十 (juu, "ten") kanji with calligraphic terminal taper.
   - **Help** = question mark with pronounced kanji-radical stroke weighting.

   Icons whose metaphor is geometrically universal (Hamburger, Close, Play, Pause, Skip, Reveal, Hide, AddCard, Delete, Copy, Filter, Calendar, Clock, Check, Cross, Warning, Info, More, Star, Flag, Speaker, Microphone) carry no cultural-form reference; they get the construction discipline and kanji-stroke weight rhythm only.

### Color & state behavior

Icons NEVER carry color of their own. All state is inherited from the parent row via `currentColor`. The three-tier rule:

- **Default rest:** parent applies `text-faded-sumi` (`#6B5F58`). Icon strokes render Faded Sumi.
- **Hover:** parent transitions to `text-sumi-ink` (`#1F1A18`) over 150ms. Cell background tints to Cream Inset (`#F4EFE6`). Icon strokes render Sumi Ink.
- **Active route:** parent applies `text-inari-vermillion` (`#B03646`). Cell background applies Vermillion Wash (`#F8E5E5`). Icon strokes render Inari Vermillion.
- **Focus-visible:** 3px Vermillion Wash halo via `--shadow-focus`. Icon color unchanged.

The icons themselves never animate — no hover transforms, no stroke-width changes, no fill changes, no rotation, no scaling, no keyframe loops. The user reads state from the row, not the icon. This is non-negotiable: hover motion was prototyped and removed because it added visual noise without clarifying state.

The brand top-stripe inside card-bodied icons (Review/Decks/AddCard/Save/Copy/Calendar) is rendered with `fill="currentColor"`, so when the row is at active state and `currentColor` is Vermillion, the top-stripe also turns Vermillion. This is the brand-coding moment: the icon's identity device matches the brand mark's identity color exactly when the route is active.

### Sizing & display context

Icons are designed at the 40×40 viewBox but display at different sizes depending on surface. The effective stroke at display follows: `effective_stroke = STROKE * (display_size / 40)`. At `STROKE = 1.25`:

| Surface | Display size | Tailwind class | Effective stroke |
|---|---|---|---|
| Nav row (sidebar/MobileDrawer) | 24px | `w-6 h-6` | 0.75px |
| Showcase grid (`/dev/components`) | 40px | `h-10 w-10` | 1.25px |
| Inline button leading icon | 14-16px | `w-3.5 h-3.5` / `w-4 h-4` | 0.44-0.5px |
| Topbar / chrome | 20px | `w-5 h-5` | 0.625px |

Below 20px display, the secondary detail lines (`STROKE * 0.5`, `opacity 0.65`) start to disappear into sub-pixel softening; that's acceptable since the focal element + primary outline still read clearly. Below 14px, even the primary stroke is at the edge; avoid using these icons below 16px display.

### File organization & exports

- **Location:** `apps/web/components/icons/chrome-marks.tsx`
- **Co-located:** `study-marks.tsx`, `dashboard-marks.tsx`, `arrow-glyph.tsx` (the onboarding collection). All four files share the directory and the same construction grammar.
- **Naming convention:** every export is `Icon<Name>` (e.g., `IconDashboard`, `IconReview`). The `Icon` prefix is canonical and reserved for chrome-marks; the onboarding files use direct names (`ToriiGate`, `BookOpen`). New icons added to chrome-marks must follow `Icon<PascalName>`.
- **Component shape:** every icon function accepts `{ className?: string }` only. No `size` prop, no `color` prop. Sizing via Tailwind classes on the `<svg>`; color via `currentColor` inheritance.
- **Catalog export (`CHROME_MARKS`):** a `ReadonlyArray<ChromeMarkEntry>` exported alongside the components, used by the showcase at `/dev/components` and any future consumer that needs to enumerate the set. Entry shape:

```ts
export interface ChromeMarkEntry {
  name:      string
  component: (props: IconProps) => React.JSX.Element
  reference: string
  group:     'nav' | 'account' | 'status' | 'drawer' | 'topbar' | 'action'
           | 'edit' | 'data' | 'feedback' | 'progress' | 'lang' | 'utility'
}
```

The twelve `group` values are functional categories, not rendering categories. They drive the showcase's section ordering and would drive any future "icon picker" UI. The `utility` group holds geometrically-universal chrome glyphs (chevrons) that don't fit the other functional categories.

### Icon Catalog

The icon set lives in `apps/web/components/icons/chrome-marks.tsx` — that file (the `CHROME_MARKS` array plus the exported `Icon*` components) is the source of truth for path data. Copy exact SVG paths from there; do **not** duplicate them in this doc (the previous inline path dumps were drift-prone). The fifty catalogued icons, by functional group and cultural / brand reference:

| Group | Icons — reference |
|---|---|
| **Nav** (5) | Dashboard (田 grid + hi-no-maru disc) · Review (card + top-stripe + tategaki) · Decks (stacked cards) · Browse (tansu, 3 drawer handles) · Analytics (sangaku peaks + hi-no-maru sun) |
| **Account** (4) | Profile (kimono V-collar) · Settings (mizuhiki bow knot) · Report a bug (speech bubble + tategaki) · Sign out (torii + shimenawa) |
| **Status** (3) | Notifications (fūrin + tanzaku) · Offline (kasumi cloud) · Search (magnifier + hi-no-maru lens) |
| **Drawer** (2) | Hamburger (3 brush strokes, middle thinner) · Close (X, right-falling heavier) |
| **Topbar** (2) | Help (? + kanji-radical weight) · Plus (十 with terminal taper) |
| **Action** (6) | Play · Pause · Skip · Reveal (eye + filled pupil) · Hide · Undo (arc-arrow) |
| **Edit** (5) | AddCard (card + top-stripe) · Edit (fude brush) · Delete (trash + X) · Save (bookmark + top-stripe) · Copy (two cards) |
| **Data** (5) | Tag (omamori) · Filter (funnel) · Sort (3 ofuda strips) · Calendar (header band + date dot) · Clock |
| **Feedback** (5) | Check · Cross (heavier than Close) · Warning (triangle + !) · Info (hi-no-maru disc + i) · More (3 brush dots) |
| **Progress** (5) | Star · Flag (nobori banner) · Streak (flame + 火) · Trophy (rice bowl + handles) · Target (hi-no-maru + rings) |
| **Language** (5) | Speaker · Microphone · Translate (A + あ + arrow) · Dictionary (wahon book) · Lightbulb (chōchin lantern) |
| **Utility** (3) | ChevronRight · ChevronLeft · ChevronDown (rotated via CSS for other directions) |

> **Known catalog gap:** the post-rename nav renders IconReviews, IconWeakSpots, IconCards, IconOverview, IconProgress, and IconForecast/IconStatistics — same construction grammar, but not yet registered in the `CHROME_MARKS` array. Add them when the showcase is next touched.

### Named rules

**The Geometric Ink-Stroke Rule.** Every chrome and component icon is a custom SVG drawn from `apps/web/components/icons/chrome-marks.tsx` (or the co-located onboarding files), matching the construction grammar above. No lucide-react imports are permitted in chrome/component code. The one exception is `ChevronRight` in `nav-item.tsx` for the sub-nav disclosure caret; that single import is the only outstanding Lucide Tax debt in the chrome system.

**The Currentcolor Inheritance Rule.** Icons render `stroke="currentColor"` on outlined paths and `fill="currentColor"` on focal/filled accents. They never carry a hard-coded color value. State is driven by the parent's color class (`text-faded-sumi` → `text-sumi-ink` → `text-inari-vermillion`).

**The Static Icon Rule.** Icons do not animate. No hover transforms, no stroke-width transitions, no scale/translate/rotate, no keyframe loops. State communication happens at the row level (cell background tint + icon color shift via inherited `currentColor`). Motion was prototyped and removed; do not reintroduce it without explicit design direction.

**The Brand Top-Stripe Rule.** Card-bodied icons (Review, Decks, AddCard, Save, Copy, Calendar) carry the Tomo top-stripe as a filled `currentColor` rectangle 2.5 units tall (or 6 units tall for Calendar's header band) at the top of the card outline. The stripe is a self-reference to the brand's actual card surfaces in `apps/web/components/ui/Card.tsx`. Do not add the stripe to icons whose metaphor is not a card; do not omit it from icons whose metaphor is a card.

**The Single-Cultural-Reference Rule.** Each icon carries at most one Japanese cultural-form reference (torii, fūrin, mizuhiki, sangaku peaks, etc.). Stacking references (e.g., a torii inside a fūrin inside a card) is forbidden — that path leads to tourist-shop iconography. Where the metaphor is geometrically universal (Play, Pause, Close, Plus, etc.), the icon uses only the construction grammar without a cultural-form reference.

**The Kanji-Stroke Weight Rule.** Selected paths within an icon may use `strokeWidth={STROKE * X}` where X is 0.5-1.5, evoking the brush-pressure rhythm of kanji-radical strokes. The variation must be deliberate (heavier on primary strokes, lighter on supporting strokes), never arbitrary. The weight rhythm is one of the system's signature distinguishing features.

**The Secondary-Detail Opacity Rule.** Tategaki text suggestion lines, page hint marks, and other interior detail lines use `strokeWidth={STROKE * 0.5}` to `{STROKE * 0.6}` and `opacity="0.65"` (sometimes `0.6` for finer marks). The opacity is what gives them their "ghosted detail" quality without competing with the primary outline.

**The 40×40 ViewBox Rule.** All chrome-marks icons are drawn in the 40×40 design unit space. This is non-negotiable across the family — it matches the existing study-marks/dashboard-marks files, so the two collections render at compatible visual weight when used adjacent. Do not introduce a 24×24 viewBox icon to chrome-marks; if a smaller surface is needed, scale the 40×40 icon down via Tailwind classes.

**The aria-hidden Rule.** Every icon ships `aria-hidden="true"` because icons are decorative. Semantic labeling lives in the surrounding text (nav label, button label, etc.). Icon-only affordances (icon-only buttons like the drawer's hamburger and close) require an explicit `aria-label` on the parent button element, not on the icon.

### Anti-goals

The icon system is shaped as much by what it rejects as what it includes:

1. **Not lucide-like.** The default reflex for an icon library is to import Lucide. This system explicitly refuses Lucide; the bespoke chrome-marks set replaces every Lucide import (except `ChevronRight` for the sub-nav caret). The brand-coding devices (top-stripe, hi-no-maru, kanji-stroke weight rhythm) are what make these distinguishable from a Lucide install.
2. **Not folkloric-overloaded.** Earlier iterations of the icon set bundled multiple Japanese folkloric references per icon (kitsune face inside a tansu, torii flanked by fox statues, ema with shimenawa frame). This was rejected as kitsch. The current system uses at most one cultural-form reference per icon, and only where the metaphor naturally invites it.
3. **Not modern-tech-pictogrammatic.** Earlier iterations went the opposite direction — Tokyo Metro pictograms, MUJI restraint, Naoto Fukasawa capsules. This was also rejected because it pulled too far from the brand: clean modern Japanese is everywhere; only the brand-aligned middle (Tomo top-stripe + kanji-stroke rhythm + cultural references where natural) is uniquely Tomo.
4. **Not animated.** Hover motion was prototyped (pulse, flex, shift, rise, tilt, spin, sway, drift, flicker, stagger) and removed. State communication via inherited `currentColor` is sufficient; icon-internal motion adds visual noise without adding clarity.
5. **Not multi-color.** Icons render in a single inherited color at any given moment. No second accent color, no gradient, no two-tone treatment. This is what keeps the system disciplined and what makes the active-state Vermillion shift land as the brand moment.

## Do's and Don'ts

These rules carry PRODUCT.md's anti-references into pixel-level specificity for the new direction.

### Do:

- **Do** use Inari Vermillion (`#B03646`) sparingly on product surfaces (≤10% of any screen) and freely on brand surfaces (30–60%). The split is the strategy.
- **Do** use Warm Paper Raised (`#FDFBF7`) for card surfaces and Warm Paper Base (`#FBF8F4`) for the page background. Replace every legacy `#FFFFFF` and every `#F9FAFB` (Cool Slate Page) during the implementation pass.
- **Do** use Sumi Ink (`#1F1A18`) for primary text and Faded Sumi (`#6B5F58`) for secondary text. Pure-black ink (`#000`) and cool-neutral ink (`#111827`) are not in the system.
- **Do** preserve the JLPT Difficulty Spectrum across all surfaces. The six values (N5 → Beyond) are signature work; do not modify, do not extend the spectrum to non-difficulty roles.
- **Do** use exactly **one** Primary button per screen, per the Single-Primary Rule.
- **Do** ship Rating buttons with four redundant signaling channels (color + glyph + label + key), per the Four-Channel Rating Rule.
- **Do** use custom ink-stroke SVGs from `apps/web/components/icons/` for every chrome and component icon, drawn to the contract in §Icon System (40×40 viewBox, `STROKE = 1.25` base, round linecap, round linejoin, `currentColor` on outlined paths and on filled focal accents, `aria-hidden="true"`). Always pair with a visible text label; the icon is decorative.
- **Do** wrap Japanese strings in `lang="ja"` (or render through `<FuriganaText>`). The lang-selector handles font-family swapping; bypassing it produces wrong glyph metrics and breaks screen readers.
- **Do** keep cards flat at rest (per the Flat-Card Rule). Reach for shadow only on overlays — popovers (`--shadow-card`), modals (`--shadow-lg`), focus halos (`--shadow-focus`).
- **Do** honor `prefers-reduced-motion` end-to-end. Every keyframe in the system is opt-out, never opt-in.
- **Do** treat the brand mark (the kitsune + 友) as a fixed identity asset. Render it from `apps/web/public/brand/logo.svg`. Do not stretch, recolor for decoration, or reduce below 14px equivalent.

### Don't:

- **Don't** use Default Tech Indigo (`#6366F1`) anywhere. It is retired. If a previous component still references `bg-primary-500`, `--color-primary-500`, or any indigo token, that token is slated for removal during implementation; new work must not reach for it.
- **Don't** confuse Aizome Indigo (`#1B3A6B`, the deep ink-blue secondary) with Default Tech Indigo (`#6366F1`, the retired trap). They are not interchangeable. If a surface's "indigo" reads as bright-saturated-violet, it is the trap; rework toward the dark-navy-ink value.
- **Don't** use `#FFFFFF` literally. The card surface is Warm Paper Raised (`#FDFBF7`); the favicon plate is `#F7F7F7` (kept for parity with the existing logo file). Pure white reads as cool-clinical-screen and breaks the mood.
- **Don't** import any new lucide-react icons. The Lucide Tax Rule applies. Use the custom geometric ink-stroke set from `apps/web/components/icons/` (chrome and components), Unicode glyphs at semantic value (Rating row only), or text affordances ("Show / Hide" instead of an eye).
- **Don't** ship a Rating button row without per-button glyphs. The Four-Channel Rating Rule applies. Color alone fails deuteranopia and protanopia users.
- **Don't** ship a filled red Danger button. The Danger Ghost Rule applies. Destructive actions read as serious-but-quiet, not alarming.
- **Don't** use more than one Primary button on a screen. The Single-Primary Rule applies. If the design needs two, one of them is the wrong variant.
- **Don't** add drop shadow to a card at rest. The Flat-Card Rule applies — depth comes from the warm-vs-cool surface contrast, the 1px border, the 2px Inari Vermillion top stripe, and (on auth/onboarding) the visible stack of fading sibling cards behind. Shadow is reserved for state and overlays.
- **Don't** write generic AI-SaaS marketing copy. *"AI-Enhanced Japanese SRS"*, *"AI-powered ✨"*, *"Premium ✨ AI-Powered!"* are all banned per PRODUCT.md Principle #7 (Invisible AI, visible craft).
- **Don't** mimic Anki's punitive utilitarianism. Flat blue defaults, raw HTML cards, "serious learners only" minimalism are the joy-vacuum.
- **Don't** introduce side-stripe borders (e.g., `border-left: 4px` as a colored callout), gradient text (`background-clip: text` over a gradient), or glassmorphic surfaces (decorative `backdrop-filter: blur`). These are universal absolute bans; they are tells of generic AI-generated UI. Note: the card's 2px Inari Vermillion *top* stripe is allowed because it's a top edge, not a side; left/right colored stripes are still banned. **Data-viz exception:** stacked-bar segment dividers in chart components (`DeckContributorsCard`, `JlptCoverageStrip`, `AnswerButtonDistribution`, `CardsByDeckBar`, `MaturityFlowBar`) use 1px `border-r border-warm-paper-raised/80` between adjacent segments as a *hairline separator*, not as a colored accent. The pattern is allowed because (a) the border color is paper-on-paper, never the brand red; (b) the wrapper is a data-viz container with `role="group"` or `role="img"`, not a Card/list-row; (c) `last:border-r-0` removes the trailing separator. Do not extend this pattern to Card or list-row chrome.
- **Don't** add a sparkle icon, an "AI mode" toggle, a "Generated by GPT" footer, or any visible AI labeling to chrome. Per PRODUCT.md Principle #7, the justification is in what the AI *makes*, not what it is *labeled.*
- **Don't** use mincho serifs (DM Serif Display, Noto Serif JP) anywhere. Display is Bricolage Grotesque, body is DM Sans, Japanese is Noto Sans JP — any "editorial-serif at the top of the page" reflex is off-system.
- **Don't** introduce a third Latin family. The Two-Family Rule allows exactly Bricolage Grotesque (display) + DM Sans (body and chrome). Hand-calligraphic and brush-style fonts are the only exception, and only on identity surfaces (wordmark, favicon, auth illustration, OG image, milestone illustrations).
- **Don't** write copy in a book or notebook metaphor. *"Open your notebook,"* *"This is your notebook,"* *"first page,"* *"first line"* are off-system. Tomo is a card-stack — the noun is *card*, not *page*. Pages are for documents; cards are for SRS.
- **Don't** introduce decorative chrome from the retired editorial direction: vertical mincho watermarks (毎日の練習), genkō yōshi (manuscript-paper) grids, marginalia columns, hanko stamps as decoration (the kanji 友 inside a sumi-ink disc as a "stamp" motif), brushstroke ornaments under titles, or imprint/colophon language ("TOMO BUNKO", "TOMO PRESS", "VOL. 一"). The kitsune mark itself is unaffected and remains the canonical brand asset.
- **Don't** ship a chrome or component icon without an accompanying text label. Icons in Tomo are decorative (every SVG carries `aria-hidden="true"`); the label carries the meaning. Icon-only affordances violate the Single-Vocabulary contract and fail screen-reader users. The exception is icon-only buttons (the mobile-drawer `×`, the hamburger `☰`), which require an `aria-label` on the *button* element instead of a visible text label.
- **Don't** mix icon vocabularies on a single screen. Geometric ink-stroke SVGs for chrome and components, Unicode glyphs for the Rating row only, never both at once. The Single-Vocabulary Rule (see §Icon System → Named Rules) keeps the visual register coherent.
- **Don't** introduce a custom icon that breaks the Geometric Ink-Stroke Spec (arbitrary mixed stroke weights, square linecaps, hard-coded colors instead of `currentColor`, a path budget beyond 4–6 elements, or a viewBox other than 40×40). The system rhythm depends on the spec being non-negotiable.
