<!-- SPEC: written 2026-05-08 alongside Tomo's complete brand redesign. The brand layer (color palette, the kitsune mark, cultural anchoring, typographic direction) and the component layer (Buttons, Inputs, Cards, Review Card, Rating Buttons, Navigation, Furigana Text: visual and token specifications) are committed. The actual implementation in `apps/web/components/` and `apps/web/app/globals.css` does NOT yet match this spec. The Components section below describes what each component SHOULD become during the next implementation pass, not what currently exists. After the migration lands, run `$impeccable document` to verify the spec was implemented faithfully and to regenerate the `.impeccable/design.json` sidecar with shadow-DOM-renderable HTML/CSS for live-panel rendering. -->

---
name: Tomo
description: Visual system spec for the post-indigo redesign. Brand layer is committed (Inari Vermillion, the kitsune mark, ink-and-disc cultural anchoring); components are prescribed for the next implementation pass. Source of truth ahead of code migration.
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
typography:
  display:
    fontFamily: "DM Sans, GT Walsheim, Inter Display, system-ui, sans-serif"
    fontWeight: 500
  body:
    fontFamily: "DM Sans, Inter, system-ui, sans-serif"
    fontWeight: 400
  japanese:
    fontFamily: "Noto Sans JP, Hiragino Sans, Yu Gothic, sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 400
rounded:
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
  card-deck:
    backgroundColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  card-review:
    backgroundColor: "{colors.warm-paper-raised}"
    rounded: "{rounded.lg}"
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

**Creative North Star: "The Iwanami Practice Notebook"**

Tomo's new visual system is built on three pillars: a deep saturated red carried as identity, a warm-paper neutral that softens every surface (no `#FFFFFF` anywhere), and a single warm humanist sans paired with Noto Sans JP for bilingual typography. The three references that anchor the system are **Iwanami Shoten** (the Japanese publisher whose pocket-book covers carry saturated solid colors against cream interiors with refined typography), **Are.na** (editorial neutrality, blocks-of-content over chrome, generous whitespace), and **iA Writer** (Japanese-typography-aware quiet design, paper-first, monospace-as-considered-choice). All three share a single value: typography and color do the heavy lifting; chrome stays out of the way.

The system is being explicitly migrated *out* of the previous "Familiar Indigo Default" lane. Default Tech Indigo `#6366F1` is retired. Lucide-react icon language is retired (icons must now be hand-drawn, kanji-as-glyph, Unicode-at-semantic-value, or text-only). Cool slate neutrals are retired in favor of warm-paper neutrals tinted toward the brand red. Filled red Danger buttons are retired in favor of Danger Ghost (transparent + vermillion-deep text). Color-only rating differentiation is retired in favor of four redundant signaling channels (color + glyph + label + keyboard number).

The mood is **the Iwanami pocket book on a kissaten table on a quiet morning**: saturated red on cream paper, hand-brushed kanji for the wordmark, a single readable sans for everything else, motion that responds rather than performs. The color strategy commits to a **Full palette**: berry red + sumi black + warm paper + a single supporting aizome-indigo, each with a deliberate job, none overlapping.

**Key Characteristics:**

- One identity color (Inari Vermillion `#B03646`), one ink color (Sumi Ink `#1F1A18`), one paper neutral (Warm Paper `#FBF8F4`), and one supporting color (Aizome Indigo `#1B3A6B`). Each has a deliberate job.
- All neutrals are tinted toward the brand red (a faint warm cast). No `#FFFFFF`. No cool slate.
- One Latin humanist sans (DM Sans / GT Walsheim / Söhne / Inter Display class) + Noto Sans JP across all hierarchy levels. JetBrains Mono retained for code-and-data surfaces only.
- Motion is **Responsive** by default: feedback, transitions, and small reveal moments. No scroll-driven choreography in product chrome; brand surfaces (auth, future landing page, OG, milestone illustrations) may opt up to Choreographed.
- The kitsune mark is the central identity asset. It surfaces at six allowed positions per PRODUCT.md Principle #6 (wordmark, favicon, auth, OG, app icon, milestone illustrations) and nowhere else.
- Icons are kanji glyphs (in navigation), Unicode glyphs at semantic value (in Rating buttons), hand-drawn SVG (everywhere else), or text-only ("Show / Hide" instead of an eye). Lucide-react is retired.
- Borders are reserved for input fields and hairline dividers. Cards use shadow only. No side-stripe borders, no gradient text, no glassmorphic surfaces.

## Colors: Vermillion on Paper

The palette commits to **Full palette** as a strategy: four named roles, each with a deliberate job, used in different proportions across product and brand registers.

### Primary

- **Inari Vermillion** (`#B03646`): the brand identity color. Used on the kitsune mark, the wordmark, primary CTAs, focus rings, active states, and milestone illustrations. On product surfaces it stays under ~10% of any given screen; on brand surfaces (auth, future landing page, OG image) it can carry 30–60% of the surface as saturated solid fields, in the manner of an Iwanami pocket-book cover. The split is the strategy.
- **Inari Vermillion Deep** (`#7E1F2A`): hover state for primary CTAs. The ink-saturated version of the brand red, used when a brand surface needs a darker variant (e.g., a saturated solid hero where the lighter vermillion would feel washed). Also the text color for the Danger Ghost button variant.
- **Vermillion Wash** (`#F8E5E5`): the lightest vermillion tint. Active-state surface (replacing the previous `--color-accent-bg` indigo-50), focus-ring halo, brand-surface accent fields where a hint of color is enough.

### Secondary

- **Aizome Indigo** (`#1B3A6B`): the supporting color, drawn from traditional Japanese indigo dye (aizome). Used sparingly: for the streak hero number on the dashboard, the "Easy" rating button, the vocabulary deck-type badge text, and occasional editorial moments where a deep ink-blue carries more authority than red (long-form grammar explanations, mnemonic attribution panels, the JLPT N3 badge family). Aizome is *not* the retired `#6366F1` indigo. The hue, saturation, and value are completely different. See the Aizome Distinction Rule.

### Neutral (Warm Paper)

The neutral ramp is **warm-paper-tinted**: every neutral has a faint hue cast toward the brand red (chroma ~0.005–0.012 in OKLCH). No `#FFFFFF`. No cool slate.

- **Warm Paper Base** (`#FBF8F4`): the page background everywhere. Replaces the retired Cool Slate Page (`#F9FAFB`).
- **Warm Paper Raised** (`#FDFBF7`): card surface color. Slightly warmer and lighter than the base. Replaces the literal `#FFFFFF` of the previous system, which violated the design laws. Also the *text color* on saturated-fill components (Primary button, Rating buttons), where pure white would feel cold.
- **Cream Inset** (`#F4EFE6`): recessed surfaces (input backgrounds, mobile review-card "Show Answer" button background, code blocks, deck-type badge backgrounds for Vocabulary and Mixed types).
- **Soft Hairline** (`#E5DCD0`): hairline borders on the sidebar edge, mobile bottom-bar separator, answer-reveal divider, input default border.
- **Faded Sumi** (`#6B5F58`): the secondary text color (descriptions, hints, stats labels, Ghost button default, Furigana reading text). Hits WCAG AA against Warm Paper Base.
- **Sumi Ink** (`#1F1A18`): the primary text color. Deep ink-brown, not pure black. Carries the "ink on paper" character of the system. Contrast against Warm Paper Base is well into AAA. Also the background fill for the "Again" Rating button.

### Named Rules

**The Vermillion Tax Rule.** Inari Vermillion is precious on product surfaces. Every new product screen must justify each red element it introduces; the default answer to "should this be red?" is "no." Brand surfaces (auth, landing, OG, milestone illustrations) operate under a different budget: red is allowed to dominate 30–60% of the surface as a saturated solid field. The split is the strategy.

**The No-Pure-White Rule.** `#FFFFFF` is banned everywhere. Card surfaces use Warm Paper Raised (`#FDFBF7`); page surfaces use Warm Paper Base (`#FBF8F4`); the favicon plate uses `#F7F7F7` (the off-white from the brand asset, kept for parity with the existing logo file); text on saturated-fill buttons uses Warm Paper Raised (`#FDFBF7`). Pure white reads as cool-clinical-screen and breaks the ink-and-paper mood.

**The Aizome Distinction Rule.** Aizome Indigo (`#1B3A6B`) is the destination; Default Tech Indigo (`#6366F1`) is the retired trap. They are *not* interchangeable. Aizome is dark-navy-ink (low chroma at lightness ~30%); Default Tech Indigo is bright-saturated-violet (high chroma at lightness ~65%). If a surface's "indigo" reads as bright tech-violet, it is the trap; rework toward the dark navy-ink value. A quick test: aizome should look correct on a hand-dyed cotton textile; Default Tech Indigo should look correct on an enterprise SaaS landing page. They live in different worlds.

**The JLPT Spectrum Rule (preserved).** The six JLPT level badges from the previous system are retained as-is: N5 Fresh Leaf (`#15803D`) → N4 Deep Emerald (`#065F46`) → N3 Clear Blue (`#1D4ED8`) → N2 Deep Violet (`#6D28D9`) → N1 Saturated Red (`#B91C1C`) → Beyond JLPT Amber-Warn (`#92400E`). This was the one place the previous system did genuine signature work; the redesign preserves it. Two of the spectrum colors (N5 Fresh Leaf and Beyond Amber-Warn) are *also* repurposed as Rating button fills (Good and Hard); see the Rating Buttons section. The cross-use is deliberate (both axes encode "difficulty level") and bounded; do not extend the JLPT spectrum to other roles.

## Typography: A Single Humanist Sans

**Latin display and body:** A warm humanist sans family. **DM Sans** is the leading candidate (Google Fonts, free, humanist character, well-rendered on screen, Pangram Pangram lineage). **GT Walsheim**, **Söhne Buch**, and **Inter Display** are paid alternatives in the same lane. Final font choice resolves at implementation; the *direction* is committed (humanist, screen-warm, single family used at multiple weights for hierarchy).

**Japanese display and body:** Noto Sans JP across all hierarchy levels. Auto-applied via the existing `[lang="ja"]` selector in `globals.css`. Never override with a Latin family on Japanese content. Also the type family used for the kanji navigation glyphs (see Components → Navigation).

**Mono:** JetBrains Mono retained for code blocks, hash-like data (review-time milliseconds, card UUIDs in dev tools), and any monospace contexts. Currently dormant in product chrome; available when needed.

**Character.** The previous Inter (Swiss-grotesque, neutral) is being replaced by a slightly warmer humanist sans to better match the hand-brushed character of the kitsune mark. The pairing with Noto Sans JP carries forward. Reading the three references (Iwanami / Are.na / iA Writer), the direction is *quiet, screen-warm, typographically-confident-without-being-loud*.

### Hierarchy

The exact type scale is **to be resolved during implementation**. The previous scale (xs `0.6875rem`, sm `0.8125rem`, base `0.9375rem`, md `1.0625rem`, lg `1.25rem`, xl `1.5rem`, 2xl `2rem`, 3xl `3rem`, 4xl `4rem`) is a reasonable starting point but should be reviewed for:

- Whether base should move to `1rem` (16px) for readability under the new humanist sans, since DM Sans-class fonts read smaller than Inter at the same px size.
- Whether the display step (3rem → 4rem) needs to grow further to give the focal Japanese word more presence on the review card under a warm-paper background.
- Whether to add a "headline" step at ~2.5rem for the future landing-page register.

The roles to map at implementation:
- **Display**: hero word on the review card, big streak numbers, auth-screen wordmark.
- **Headline**: major page-section headings (currently rare; will appear more on the future landing page).
- **Title**: section titles, modal headers.
- **Body**: default reading text (sentences, mnemonics, grammar explanations).
- **Body Small**: nav labels, stats rows, hints.
- **Label**: badges, keyboard-shortcut chips.

### Named Rules

**The Single-Sans Rule.** One Latin sans family across the entire system, varied by weight and (occasionally) style. Adding a second Latin family (e.g., a serif for display) is rejected unless we move to a different typographic direction in a future redesign. The character contrast that an editorial-serif system would carry is provided here by *weight contrast* within a single family, not by family contrast. The minimum scale ratio between hierarchy steps is 1.25 (per the design laws); aim for 1.33–1.5 between display, headline, and title.

**The Lang-Attr Rule (preserved).** Japanese content must always be wrapped in an element with `lang="ja"`, which automatically swaps the font stack to Noto Sans JP. Never override the font family on Japanese content with a Latin family. Never use a Latin family on a parent that contains Japanese children: the cascade will produce mojibake-quality glyph rendering.

**The Furigana Rule (preserved).** Furigana renders only through the `<FuriganaText>` component (semantic `<ruby>`/`<rt>` markup). Visual approximations (positioned spans, vertical-align hacks, decorative SVG) are forbidden because they break screen-reader pronunciation.

**The Hand-Calligraphic Exception.** The wordmark and the kanji rendered inside the kitsune logo are hand-brushed (not typeset). They are not subject to the Single-Sans Rule because they are *images*, not text. Klee One, brush-style display fonts, and bespoke calligraphy are permitted in identity surfaces only (the wordmark, the favicon, the auth screen, the OG image, milestone illustrations) and must never appear in body or chrome typography.

**The Body-Reading Rule.** Cap body line length at 65–75 characters per line for readability (per the design laws). On long-form surfaces (grammar explanations, mnemonic readouts, the future landing page), enforce this with `max-width: 70ch` or similar; on dense product surfaces (deck list, settings), the rule applies less strictly because content lines are typically short by composition.

## Elevation: Quiet Ink-and-Paper

The system uses **quiet ambient elevation**, the same strategy as the previous version, with two adjustments. First, the page background is now Warm Paper Base (`#FBF8F4`), so card-on-page contrast is gentler than it was on Cool Slate. Second, shadow color now carries a faint warm-red cast (rather than pure neutral black) to harmonize with the warm-paper neutrals.

There are no borders on shadowed surfaces. Depth is conveyed by shadow alone. Cards float on the page; they are not framed.

### Shadow Vocabulary

Exact box-shadow values resolve at implementation, but the vocabulary is committed to four roles:

- **Card Resting Shadow**: workhorse for deck cards, review cards, dialog containers. Warm-tinted at low opacity (approximately `0 4px 12px oklch(20% 0.02 25 / 0.07)` or similar). Hover lifts to the next step.
- **Modal Lift Shadow**: stronger lift for the auth-screen card, modal dialogs, and the future landing-page hero. Same warm tint at higher opacity.
- **Soft Hairline Shadow**: lightest possible separation, reserved for moments of hint-of-lift only.
- **Focus Ring**: keyboard focus indicator. Replaces the previous `0 0 0 3px #C7D2FE` (indigo-200 halo) with `0 0 0 3px #F8E5E5` (Vermillion Wash) for product chrome. Brand surfaces may use a stronger ring at full Inari Vermillion.

### Named Rules

**The Shadow-Over-Border Rule (preserved).** Card-shaped surfaces use shadow, never border, for separation. Borders are reserved for inputs and hairline dividers. A card with both shadow and border is wrong; pick one.

**The Flat-At-Rest Rule (preserved).** Surfaces are flat at rest; shadows respond to *state* (focus, hover, dialog presentation), not to decoration. Buttons, badges, and nav items are part of the resting plane.

**The Warm-Tint Shadow Rule (new).** Shadow color carries a faint warm cast that matches the warm-paper neutrals. A pure-neutral-black shadow on warm paper looks gray and cold; a warm-tinted shadow harmonizes with the page. Practical implementation: shadow color uses OKLCH with a low chroma toward hue ~25 (the same hue family as the warm-paper neutrals), not `rgba(0,0,0,X)`.

## Components

The component library below is **prescribed**, not described. The current code in `apps/web/components/` and the chrome under `apps/web/app/(app)/_components/` does not yet match this section. Implementation must migrate to the spec below; afterward, run `$impeccable document` to verify the spec landed and to regenerate the `.impeccable/design.json` sidecar with shadow-DOM-renderable HTML/CSS for the live panel.

### Buttons

The button is **a block of color resting on warm paper**. It is not a glossy clickable thing; it is the page's voice acting on a control. Four variants (Primary, Secondary, Ghost, Danger Ghost), three sizes (sm, md, lg).

- **Shape:** Gently curved, 10px radius (`rounded-md`), uniform across variants and sizes.
- **Sizes:** sm (`h-8 px-3 text-sm`), md (`h-10 px-4 text-base`, default), lg (`h-12 px-5 text-lg`).
- **Primary:** Inari Vermillion (`#B03646`) background, Warm Paper Raised (`#FDFBF7`) text. Hovers to Inari Vermillion Deep (`#7E1F2A`). The most expressive button; reserved for the single most important action on a screen, never used twice in the same view.
- **Secondary:** Warm Paper Raised (`#FDFBF7`) background, Sumi Ink (`#1F1A18`) text, 1px Soft Hairline (`#E5DCD0`) border. Hovers to Cream Inset (`#F4EFE6`) background. Used for "Cancel" and lower-emphasis CTAs adjacent to a Primary button.
- **Ghost:** Transparent background, Faded Sumi (`#6B5F58`) text, no border. Hovers to Cream Inset (`#F4EFE6`) background and Sumi Ink text. Used for icon-only buttons, tertiary text actions, and the mid-review "Show Answer" affordance (per the Show-Answer Quiet Rule).
- **Danger Ghost:** Transparent background, Inari Vermillion Deep (`#7E1F2A`) text. Hovers to Vermillion Wash (`#F8E5E5`) background. Replaces the previous filled Danger button; destructive actions read as serious-but-quiet rather than alarming. Filled Primary remains available for "destructive but expected" cases (e.g., "Delete deck" after the user types DELETE in a confirmation field), where the typed confirmation already carries the gravity.
- **Focus:** All variants use a 3px Vermillion Wash (`#F8E5E5`) ring on `:focus-visible`. The previous indigo-200 halo is retired.
- **Active state:** All variants press with `transform: scale(0.98)`. No additional color change; the press is felt, not announced.
- **Disabled:** Opacity 0.4, pointer-events disabled.
- **Loading:** Spinner SVG inline before the children. Children stay visible. The spinner is a hand-traced curve (designed during implementation), not a lucide-react default.

### Inputs

The input is **a recessed page in a notebook**. The Cream Inset background makes it read as cut into the page rather than floating above it.

- **Style:** `h-10 px-3`, Cream Inset (`#F4EFE6`) background, 1px Soft Hairline (`#E5DCD0`) border, 10px radius (`rounded-md`), Sumi Ink (`#1F1A18`) text.
- **Placeholder:** Faded Sumi (`#6B5F58`) at the same weight (no italic, no extra styling).
- **Focus:** Border shifts to Inari Vermillion (`#B03646`); 3px Vermillion Wash (`#F8E5E5`) halo; background remains Cream Inset.
- **Error:** Border shifts to JLPT N1 Saturated Red (`#B91C1C`); 3px tinted halo at low opacity; error message renders below at `text-xs` in JLPT N1 Saturated Red with `role="alert"`.
- **Disabled:** Opacity 0.5, pointer-events disabled.
- **Label:** Body Small, Faded Sumi or Sumi Ink depending on emphasis, 0.375rem gap between label and input.
- **Password fields:** Use a small "Show / Hide" *text* affordance at the right edge, not a lucide eye icon. Per the Lucide Tax Rule (see Don'ts), any decorative or affordance-level icon must move away from lucide-react.

### Cards (Generic)

Cards are **pages floating on the warm-paper desk**. Soft warm-tinted shadow, no border, gently curved corners.

- **Corner Style:** 14px radius (`rounded-lg`).
- **Background:** Warm Paper Raised (`#FDFBF7`).
- **Shadow Strategy:** Card Resting Shadow at rest (warm-tinted, low opacity); hover lifts to a slightly stronger shadow without changing scale or borders. See §Elevation.
- **Border:** None. Shadow alone conveys lift (per the Shadow-Over-Border Rule).
- **Internal Padding:** `1.25rem` for list-row cards; `2rem` for content-dense cards; `2rem 3rem` for the signature Review Card.
- **Hover behavior:** Shadow lifts only. No scale, no border highlight, no color change.

### Deck Card (List-Row)

Used in the deck-list grid, the deck-card carries a deck title, a deck-type pill, optional description, stats row, and progress bar. It applies the page-enter animation with a 50ms stagger by index when the list mounts.

- **Header row:** Deck title in Body (`font-semibold`, Sumi Ink) on the left, deck-type pill on the right, options-button ghost trailing.
- **Deck-type pill:** rounded-full, `px-2 py-0.5`, `text-xs font-medium`. Vocabulary uses Aizome Indigo (`#1B3A6B`) text on Cream Inset (`#F4EFE6`) background; Kanji uses Inari Vermillion Deep (`#7E1F2A`) text on Vermillion Wash (`#F8E5E5`) background; Mixed uses Faded Sumi text on Cream Inset background. The previous indigo-100/700 mapping is retired.
- **Description:** Body Small, Faded Sumi, single-line truncate.
- **Stats row:** `text-xs`, Faded Sumi for normal counts; the due count, when greater than zero, shifts to JLPT N1 Saturated Red (`#B91C1C`) with `font-medium` to read as gentle urgency (not alarm).
- **Progress bar:** `h-1` track at Cream Inset, fill at Inari Vermillion. Width transitions on data change. The bar is the one acceptable place for full-saturation Vermillion at a small surface area, since the visual mass is tiny (1px tall).

### Review Card (Signature)

The defining surface of the app. The review card is **a single page from a notebook**: focal Japanese word centered, supporting chrome restrained, the answer revealed below an answer-divider. Max-width 640px; centered horizontally on the page.

- **Outer card:** 14px radius, Warm Paper Raised background, Card Resting Shadow.
- **Top chrome:** `text-xs` card-type pill (Reading / Writing / Listening) at top-left, Faded Sumi text on Cream Inset background, rounded-full, padded `px-2.5 py-0.5`.
- **Focus zone:** Display size (final scale to be set at implementation; ≥3rem suggested), Noto Sans JP, `font-medium`, Sumi Ink, centered. Padding `pt-8 pb-8 px-12` around the word.
- **Pre-reveal control:** "Show Answer" Ghost Button (NOT a Primary button). Below the button, a `text-xs` Faded Sumi hint reads "or press Space."
- **Answer reveal:** Triggers the `card-reveal` keyframe (250ms fade-in plus -8px translate). Reveals a `border-t` of Soft Hairline followed by, in order: the FuriganaText (kanji + reading), the English meaning in Body, and (if available) an example sentence in a nested Cream Inset surface (Japanese with furigana on top, English translation in Faded Sumi below).
- **Distinctive behavior:** The mid-review "Show Answer" button is intentionally Ghost-quiet so the Rating buttons that follow can be the loudest moment of the screen. Per the Show-Answer Quiet Rule (preserved).

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

Two surfaces (desktop Sidebar, mobile Bottom Bar) share a vocabulary but differ in shape. Both replace the previous lucide-react icon language with **single-kanji glyphs** drawn from the Japanese vocabulary the learner is studying. The kanji do double duty: they are navigation icons *and* they are vocabulary the user is learning.

- **Sidebar (desktop):** 240px (`w-60`) fixed-width column, Warm Paper Raised background, 1px Soft Hairline right border, full screen height. Header strip carries the brand logo SVG (`apps/web/public/brand/logo.svg`) at ~28px height followed by "Tomo" wordmark in Body, Sumi Ink. Nav items are pill-rows: 10px radius, Body Small, padded `px-3 py-2`, gap `0.75rem` between glyph and label.
- **Mobile Bottom Bar:** Fixed bottom, Warm Paper Raised background, 1px Soft Hairline top border, 4 tabs equally distributed. Each tab is a flex-column with kanji glyph (size ~1.25rem in Noto Sans JP) above a label in `text-xs font-medium`. No selected pill, no fill change; active state is text color shift only.
- **Default state (both surfaces):** Faded Sumi (`#6B5F58`) text on transparent background.
- **Hover (Sidebar only):** Cream Inset (`#F4EFE6`) background, Sumi Ink text.
- **Active state:** Sidebar uses Vermillion Wash (`#F8E5E5`) background and Inari Vermillion (`#B03646`) text. Mobile uses Inari Vermillion text only (no fill).
- **Kanji glyph mapping (proposed):**

| Surface | Kanji | Reading | Meaning | JLPT Level |
|---|---|---|---|---|
| Dashboard / Home | 家 | uchi / ie | house | N5 |
| Decks | 本 | hon | book | N5 |
| Review | 復 | fuku | return / repeat | N3 |
| Analytics | 統 | tō | statistics | N2 |
| Settings | 設 | setsu | establish | N3 |

- **Implementation note:** Kanji-as-icons is a deliberate identity choice with two side effects. (1) The icons reinforce the product's premise (the user is learning Japanese; the chrome itself teaches a kanji). (2) Absolute beginners may not recognize all the glyphs at first; the always-visible English label resolves this. The glyph must never appear without an accompanying label.

### Furigana Text (Signature Primitive)

The semantic ruby/rt component, preserved end-to-end with one tonal adjustment.

- **Markup:** `<ruby lang="ja">{text}<rt>{reading}</rt></ruby>` rendered through the `<FuriganaText>` component.
- **Ruby (kanji body):** Noto Sans JP, font size matches context (Display, Body, etc.), Sumi Ink color.
- **Rt (reading hint):** Noto Sans JP, 0.4em (40% of parent size), font-weight 400, **Faded Sumi (`#6B5F58`)** color. The previous default (full Sumi Ink at `text-xs`) is replaced by Faded Sumi to make the reading visibly subordinate so the kanji remains the primary focus. The reading is supporting cast, not co-lead.
- **Accessibility:** `<ruby>` is read with the kanji and reading combined; screen readers handle the pronunciation correctly. Visual approximations (positioned spans, vertical-align hacks, decorative SVG) are forbidden because they break this contract.

### Named Rules

**The Single-Primary Rule.** A given screen has at most one Primary button visible at any moment. If the design needs two, one of them is the wrong variant; downgrade to Secondary, Ghost, or Danger Ghost. The Vermillion Tax Rule (see §Colors) forbids spending the brand red twice on a single product surface.

**The Lucide Tax Rule.** Every icon today is `lucide-react` at `strokeWidth=1.5`. New work replaces them with one of: a hand-drawn SVG sprite (designed during implementation), a single kanji glyph (per the Navigation section), a Unicode glyph at semantic value (↺ ◐ ✓ ☆ for the Rating row), or a text-only affordance ("Show / Hide" instead of an eye icon). The migration is gradual, but no new lucide imports may land. The cost of crossing this line is the entire visual identity collapsing back into the AI-SaaS lane.

**The Show-Answer Quiet Rule (preserved).** The mid-review "Show Answer" affordance is a Ghost button, not a Primary. The four Rating buttons that follow are the loudest moment of the screen; the reveal control must not compete.

**The Kanji-as-Nav Rule (new).** Navigation icons in the Sidebar and Mobile Bottom Bar are single kanji glyphs (Noto Sans JP), not lucide icons or hand-drawn marks. The kanji must always be paired with an English label; the glyph alone is never sufficient. The proposed mapping (家 / 本 / 復 / 統 / 設) is the canonical set; substituting requires PRD-level review.

**The Four-Channel Rating Rule (new).** Rating buttons (FSRS Again / Hard / Good / Easy) ship four redundant signaling channels: background color, glyph icon, label text, and keyboard number. A button missing any channel is incomplete. Never ship a color-only rating row again; the previous design failed deuteranopia and protanopia users.

**The Danger Ghost Rule (new).** Filled red Danger buttons are retired (the previous `bg-danger-500` variant). Destructive actions use the Danger Ghost variant (transparent + Inari Vermillion Deep text). Filled Primary buttons remain available for "destructive but expected" actions where the user has already typed a confirmation token (e.g., typing DELETE in an input before the deletion button enables).

## Do's and Don'ts

These rules carry PRODUCT.md's anti-references into pixel-level specificity for the new direction.

### Do:

- **Do** use Inari Vermillion (`#B03646`) sparingly on product surfaces (≤10% of any screen) and freely on brand surfaces (30–60%). The split is the strategy.
- **Do** use Warm Paper Raised (`#FDFBF7`) for card surfaces and Warm Paper Base (`#FBF8F4`) for the page background. Replace every legacy `#FFFFFF` and every `#F9FAFB` (Cool Slate Page) during the implementation pass.
- **Do** use Sumi Ink (`#1F1A18`) for primary text and Faded Sumi (`#6B5F58`) for secondary text. The previous neutral-900 (`#111827`) is replaced everywhere.
- **Do** preserve the JLPT Difficulty Spectrum across all surfaces. It is the one piece of the previous system that survives intact.
- **Do** use exactly **one** Primary button per screen, per the Single-Primary Rule.
- **Do** ship Rating buttons with four redundant signaling channels (color + glyph + label + key), per the Four-Channel Rating Rule.
- **Do** use kanji glyphs for nav icons (家 / 本 / 復 / 統 / 設) per the Kanji-as-Nav Rule. Always paired with an English label.
- **Do** wrap Japanese strings in `lang="ja"` (or render through `<FuriganaText>`). The lang-selector handles font-family swapping; bypassing it produces wrong glyph metrics and breaks screen readers.
- **Do** keep elevation quiet and warm-tinted. Card Resting Shadow is the workhorse; reach for Modal Lift Shadow only on dialogs, the auth panel, and brand-register hero cards.
- **Do** honor `prefers-reduced-motion` end-to-end. The contract from the previous system carries forward: every keyframe is opt-out, never opt-in.
- **Do** treat the brand mark (the kitsune + 友) as a fixed identity asset. Render it from `apps/web/public/brand/logo.svg`. Do not stretch, recolor for decoration, or reduce below 14px equivalent.

### Don't:

- **Don't** use Default Tech Indigo (`#6366F1`) anywhere. It is retired. If a previous component still references `bg-primary-500`, `--color-primary-500`, or any indigo token, that token is slated for removal during implementation; new work must not reach for it.
- **Don't** confuse Aizome Indigo (`#1B3A6B`, the deep ink-blue secondary) with Default Tech Indigo (`#6366F1`, the retired trap). They are not interchangeable. If a surface's "indigo" reads as bright-saturated-violet, it is the trap; rework toward the dark-navy-ink value.
- **Don't** use `#FFFFFF` literally. The card surface is Warm Paper Raised (`#FDFBF7`); the favicon plate is `#F7F7F7` (kept for parity with the existing logo file). Pure white reads as cool-clinical-screen and breaks the mood.
- **Don't** import any new lucide-react icons. The Lucide Tax Rule applies. Use kanji glyphs (nav), Unicode glyphs (rating row), hand-drawn SVG (everywhere else), or text affordances ("Show / Hide" instead of an eye).
- **Don't** ship a Rating button row without per-button glyphs. The Four-Channel Rating Rule applies. Color alone fails deuteranopia and protanopia users.
- **Don't** ship a filled red Danger button. The Danger Ghost Rule applies. Destructive actions read as serious-but-quiet, not alarming.
- **Don't** use more than one Primary button on a screen. The Single-Primary Rule applies. If the design needs two, one of them is the wrong variant.
- **Don't** write generic AI-SaaS marketing copy. *"AI-Enhanced Japanese SRS"*, *"AI-powered ✨"*, *"Premium ✨ AI-Powered!"* are all banned per PRODUCT.md Principle #7 (Invisible AI, visible craft). The auth-screen subtitle is the canonical example to remove during implementation.
- **Don't** mimic Anki's punitive utilitarianism. Flat blue defaults, raw HTML cards, "serious learners only" minimalism are the joy-vacuum.
- **Don't** stack a border *and* a shadow on the same card-shaped surface. Pick one.
- **Don't** introduce side-stripe borders (e.g., `border-left: 4px` as a colored callout), gradient text (`background-clip: text` over a gradient), or glassmorphic surfaces (decorative `backdrop-filter: blur`). These are universal absolute bans; they are tells of generic AI-generated UI.
- **Don't** add a sparkle icon, an "AI mode" toggle, a "Generated by GPT" footer, or any visible AI labeling to chrome. Per PRODUCT.md Principle #7, the justification is in what the AI *makes*, not what it is *labeled.*
- **Don't** use a serif Latin font in body or chrome typography. The Single-Sans Rule applies. Hand-calligraphic and brush-style fonts are the only typographic exception, and only on identity surfaces (wordmark, favicon, auth, OG, milestone illustrations).
- **Don't** ship the kanji nav glyphs without an English label beside them. The Kanji-as-Nav Rule requires both; an unlabeled glyph fails users at low JLPT levels and screen-reader users.
