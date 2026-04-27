# UX/UI Design Specification
## AI-Enhanced FSRS for Japanese

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-04-24

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Visual Language](#2-visual-language)
3. [Typography](#3-typography)
4. [Color System](#4-color-system)
5. [Spacing & Layout Grid](#5-spacing--layout-grid)
6. [Iconography](#6-iconography)
7. [Component Library](#7-component-library)
8. [Interaction Design](#8-interaction-design)
9. [Japanese Text Rendering](#9-japanese-text-rendering)
10. [Accessibility Standards](#10-accessibility-standards)
11. [Responsive Behavior](#11-responsive-behavior)
12. [Motion & Animation](#12-motion--animation)
13. [Dark Mode](#13-dark-mode)
14. [Onboarding Experience](#14-onboarding-experience)

---

## 1. Design Philosophy

### 1.1 Core Principles

**Clarity over decoration.** Every visual element must serve comprehension. Japanese text is already visually complex — the UI must never compete with the content. Whitespace, restraint, and clear hierarchy are primary tools.

**Speed of recall, not speed of click.** The review session is the heart of the product. The interface must vanish during review — no chrome, no distractions, no loading states that interrupt cognitive flow. A user's brain should be fully engaged with the Japanese, not the UI.

**Confidence through progress visibility.** Learning Japanese is a multi-year commitment. The UI should regularly surface evidence of progress — not just streaks, but genuine comprehension growth — to sustain motivation over the long term.

**Informed density.** Power users (advanced learners) need access to card metadata, FSRS stats, and AI tools. New users need a clean, guided path. The UI achieves both through progressive disclosure — simple by default, detailed on demand.

### 1.2 Tone & Personality

The product's visual personality is **calm, intelligent, and focused** — like a well-designed textbook or a clean study desk. It is not playful or gamified (that's Duolingo's lane), nor is it clinical and austere (that's Anki's problem). The closest reference points are Notion's clean density and Linear's purposeful interactions, adapted for a learning context.

Avoid:
- Excessive color and badge rewards that cheapen the sense of mastery
- Skeuomorphic flashcard "flip" effects that add latency
- Aggressive empty states that pressure the user to add more cards

---

## 2. Visual Language

### 2.1 Design System Name

**Tomo** (友) — meaning "friend" in Japanese. The system is a companion to the learner, not a teacher or examiner.

### 2.2 Border Radius

Consistent rounding creates warmth without looking playful.

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | `6px` | Badges, tags, small chips |
| `radius-md` | `10px` | Buttons, input fields |
| `radius-lg` | `14px` | Cards, panels, dialogs |
| `radius-xl` | `20px` | Modal sheets, drawer panels |
| `radius-full` | `9999px` | Pills, avatar circles |

### 2.3 Elevation & Shadow

Shadows are subtle and directional. They indicate layering, not decoration.

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | Hovered items, subtle lift |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Cards, panels |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Dialogs, dropdowns |
| `shadow-focus` | `0 0 0 3px var(--color-primary-200)` | Keyboard focus ring |

### 2.4 Surface Hierarchy

Four surface levels define depth and importance:

| Level | Token | Description |
|---|---|---|
| Base | `surface-base` | Page background |
| Raised | `surface-raised` | Cards, panels |
| Overlay | `surface-overlay` | Modals, dropdowns |
| Inset | `surface-inset` | Input backgrounds, code blocks |

---

## 3. Typography

### 3.1 Font Stack

Three fonts are used — one for Latin UI, one for Japanese content, and one monospace for data/code.

| Role | Font | Fallback | Usage |
|---|---|---|---|
| UI / Latin | **Inter** | system-ui, sans-serif | All UI copy, labels, navigation |
| Japanese Content | **Noto Sans JP** | Hiragino Sans, Yu Gothic, sans-serif | All Japanese text on cards, examples, readings |
| Data / Mono | **JetBrains Mono** | monospace | FSRS stats, card IDs, code |

Both Inter and Noto Sans JP are loaded from Google Fonts with `font-display: swap`. Noto Sans JP is subset to the characters actually used in the user's deck using unicode-range to minimize payload.

### 3.2 Type Scale

Based on a 4px base unit with a 1.25 major third modular scale.

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 11px | 16px | 400 | Metadata, timestamps |
| `text-sm` | 13px | 20px | 400 | Secondary labels, captions |
| `text-base` | 15px | 24px | 400 | Body copy, card meanings |
| `text-md` | 17px | 26px | 500 | Primary labels, nav items |
| `text-lg` | 20px | 28px | 500 | Section headers |
| `text-xl` | 24px | 32px | 600 | Page titles |
| `text-2xl` | 32px | 40px | 700 | Dashboard headlines |
| `text-3xl` | 48px | 56px | 700 | Primary review card word |
| `text-4xl` | 64px | 72px | 700 | Large kanji display |

### 3.3 Japanese-Specific Type Rules

- **Primary card word:** `text-3xl` Noto Sans JP, weight 700. For kanji cards, `text-4xl`.
- **Furigana (reading above kanji):** `text-xs` Noto Sans JP, weight 400. Always rendered via `<ruby>` elements with the `<FuriganaText>` component.
- **Example sentences:** `text-base` Noto Sans JP, weight 400. Line height 1.9 for readability (tighter than Latin text norms).
- **Reading (hiragana/romaji below word):** `text-sm` Noto Sans JP, color `text-secondary`.
- Never mix Inter and Noto Sans JP on the same line. Japanese content always uses Noto Sans JP exclusively.

---

## 4. Color System

### 4.1 Palette Philosophy

The palette is minimal and semantic. There are no decorative colors. Every color communicates a meaning. Primary is a calm indigo-blue (knowledge, focus) rather than red or orange (which connote urgency or error).

### 4.2 Primitive Tokens (Light Mode)

```
Indigo (Primary)
  --color-primary-50:   #EEF2FF
  --color-primary-100:  #E0E7FF
  --color-primary-200:  #C7D2FE
  --color-primary-300:  #A5B4FC
  --color-primary-400:  #818CF8
  --color-primary-500:  #6366F1   ← brand primary
  --color-primary-600:  #4F46E5
  --color-primary-700:  #4338CA
  --color-primary-800:  #3730A3
  --color-primary-900:  #312E81

Neutral (Gray)
  --color-neutral-0:    #FFFFFF
  --color-neutral-50:   #F9FAFB
  --color-neutral-100:  #F3F4F6
  --color-neutral-200:  #E5E7EB
  --color-neutral-300:  #D1D5DB
  --color-neutral-400:  #9CA3AF
  --color-neutral-500:  #6B7280
  --color-neutral-600:  #4B5563
  --color-neutral-700:  #374151
  --color-neutral-800:  #1F2937
  --color-neutral-900:  #111827

Success (Green)
  --color-success-100:  #DCFCE7
  --color-success-500:  #22C55E
  --color-success-700:  #15803D

Warning (Amber)
  --color-warning-100:  #FEF3C7
  --color-warning-500:  #F59E0B
  --color-warning-700:  #B45309

Danger (Red)
  --color-danger-100:   #FEE2E2
  --color-danger-500:   #EF4444
  --color-danger-700:   #B91C1C
```

### 4.3 Semantic Tokens

Semantic tokens are what components use directly. They map to primitives per mode.

| Semantic Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `color-bg-base` | neutral-50 | neutral-900 | Page background |
| `color-bg-raised` | neutral-0 | neutral-800 | Cards, panels |
| `color-bg-overlay` | neutral-0 | neutral-700 | Modals |
| `color-bg-inset` | neutral-100 | neutral-850 | Input backgrounds |
| `color-text-primary` | neutral-900 | neutral-50 | Primary text |
| `color-text-secondary` | neutral-500 | neutral-400 | Secondary labels |
| `color-text-muted` | neutral-400 | neutral-500 | Disabled, placeholders |
| `color-border-subtle` | neutral-200 | neutral-700 | Dividers, subtle borders |
| `color-border-default` | neutral-300 | neutral-600 | Input borders |
| `color-accent` | primary-500 | primary-400 | Links, interactive elements |
| `color-accent-bg` | primary-50 | primary-900 | Accent backgrounds |

### 4.4 Review Rating Colors

The four FSRS rating buttons use a consistent color language that builds muscle memory over time.

| Rating | Color Token | Hex (Light) | Label |
|---|---|---|---|
| Again | `color-danger-500` | `#EF4444` | Again |
| Hard | `color-warning-500` | `#F59E0B` | Hard |
| Good | `color-success-500` | `#22C55E` | Good |
| Easy | `color-primary-500` | `#6366F1` | Easy |

These colors must be consistent everywhere the ratings appear (buttons, history charts, review logs). Do not reuse these colors for other meanings.

### 4.5 JLPT Level Colors

Each JLPT level has a consistent badge color throughout the app.

| Level | Background | Text |
|---|---|---|
| N5 | `#DCFCE7` | `#15803D` |
| N4 | `#D1FAE5` | `#065F46` |
| N3 | `#DBEAFE` | `#1D4ED8` |
| N2 | `#EDE9FE` | `#6D28D9` |
| N1 | `#FEE2E2` | `#B91C1C` |
| Beyond JLPT | `#FEF3C7` | `#92400E` |

---

## 5. Spacing & Layout Grid

### 5.1 Spacing Scale

Based on a 4px base unit.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Micro gaps between tightly related elements |
| `space-2` | 8px | Padding inside compact components |
| `space-3` | 12px | Gap between label and input |
| `space-4` | 16px | Standard padding inside cards |
| `space-5` | 20px | Gap between related sections |
| `space-6` | 24px | Standard section padding |
| `space-8` | 32px | Major section separation |
| `space-10` | 40px | Page section gaps |
| `space-12` | 48px | Large layout gaps |
| `space-16` | 64px | Vertical page rhythm |

### 5.2 Layout Grid

- **Sidebar:** Fixed `240px` width on desktop; collapsed to `56px` icon-only mode; hidden on mobile.
- **Main content:** Fluid, max-width `960px`, centered with `space-8` horizontal padding.
- **Review session:** Full-bleed, no sidebar, centered card with max-width `640px`.
- **Analytics page:** Two-column grid (60/40 split) for charts + stat panels on desktop; single column on mobile.
- **Settings page:** Single column, max-width `640px`.

### 5.3 Review Card Dimensions

The review card is the most critical layout unit.

| State | Width | Min Height | Padding |
|---|---|---|---|
| Front (question) | 100% max 640px | 280px | 48px |
| Back (answer revealed) | 100% max 640px | auto | 48px |
| Rating buttons row | 100% max 640px | 64px | 16px |

---

## 6. Iconography

- **Icon library:** Lucide Icons (already in the tech stack). Consistent stroke weight `1.5`, no filled variants except for active/selected states.
- **Icon sizes:** `16px` for inline/label icons, `20px` for navigation, `24px` for action buttons, `32px` for empty states.
- **Japanese-specific icons:** For concepts with no good Lucide equivalent (pitch accent, furigana toggle, kanji radical), use a small set of custom SVG icons stored in `components/ui/icons/`.
- Icons must never appear alone without a visible label or `aria-label`. The only exception is the sidebar in collapsed mode, where icons are accompanied by tooltips.

---

## 7. Component Library

### 7.1 Button

Four variants, three sizes, consistent across light and dark mode.

| Variant | Usage |
|---|---|
| `primary` | Single primary action per view (e.g. "Start Review", "Generate Card") |
| `secondary` | Secondary actions (e.g. "Cancel", "Edit") |
| `ghost` | Tertiary, low-emphasis actions in dense layouts |
| `danger` | Destructive actions (e.g. "Delete Deck") — always requires confirmation dialog |

| Size | Height | Font | Padding |
|---|---|---|---|
| `sm` | 32px | text-sm | 12px horizontal |
| `md` | 40px | text-base | 16px horizontal |
| `lg` | 48px | text-md | 20px horizontal |

States: default, hover (+2% brightness), active (scale 0.98), focus (focus ring), disabled (40% opacity, no pointer events).

### 7.2 Review Rating Buttons

These are the most-used interactive elements in the app. They must be:
- Large enough to tap on mobile without precision (min 56px height on mobile)
- Keyboard-accessible via number keys (1=Again, 2=Hard, 3=Good, 4=Easy)
- Color-coded per §4.4 above
- Labels always visible — never icon-only

```
┌──────────┬──────────┬──────────┬──────────┐
│  Again   │   Hard   │   Good   │   Easy   │
│   (1)    │   (2)    │   (3)    │   (4)    │
│  [red]   │ [amber]  │ [green]  │ [indigo] │
└──────────┴──────────┴──────────┴──────────┘
```

Each button also shows the next interval on hover/focus: "Good · 3d", "Easy · 9d". This previews the FSRS scheduling decision before the user commits.

### 7.3 Card Display

The review card has two faces. Transition between them is a vertical slide (not a flip — flips add perceived latency).

**Front face:**
- Large centered word (`text-3xl` or `text-4xl` for kanji)
- Deck name badge (top-left)
- Card type badge (top-right)
- Progress indicator (bottom)
- "Show Answer" button or spacebar hint

**Back face:**
- Word + reading (furigana via `<FuriganaText>`)
- Meaning (primary)
- Example sentence (Japanese + English)
- Expandable sections: Kanji Breakdown, Mnemonic, Similar Cards
- "Explain" button (triggers AI explanation panel)
- Rating buttons (pinned to bottom)

### 7.4 Badge / Tag

Used for JLPT levels, register tags, card types, and deck labels.

- Always uses the color tokens from §4.5 for JLPT levels
- Register tags use neutral colors with a colored left border
- Max 2 badges visible on a card in list view; overflow shown as "+N more"

### 7.5 Input Fields

- Height: `40px` (`md`), `32px` (`sm`)
- Border: `1px solid color-border-default`
- Focus: border color changes to `color-accent`, with focus ring
- Japanese input fields: `font-family: Noto Sans JP` automatically applied when `lang="ja"` attribute is present
- IME-aware: do not trigger form submission on Enter during IME composition (use `isComposing` check)

### 7.6 Progress Bar

Used in review sessions and deck completion displays.

- Height: `6px` for session progress, `4px` for deck completion
- Background: `color-border-subtle`
- Fill: animated with `transition: width 300ms ease`
- Color: primary for in-progress, success for 100%
- Always accompanied by a text label ("12 / 50 cards")

### 7.7 Empty States

Empty states are calm and instructive, not demanding.

Structure per empty state:
1. A simple, non-animated illustration (SVG, max 160px)
2. A headline (what's empty)
3. One sentence of explanation
4. One clear call-to-action button

Examples:
- Empty deck: "No cards yet. Add your first word or browse premade decks."
- No reviews due: "You're all caught up. Next review in 3 hours."
- New user: "Pick a deck to get started." → [Browse Premade Decks]

### 7.8 AI Panel

The AI explanation panel is a slide-in drawer (from the right on desktop, from the bottom on mobile). It must feel fast — stream the OpenAI response token-by-token using `ReadableStream` so the user sees text appearing immediately, not a blank panel with a spinner.

- Width: `380px` on desktop
- Background: `surface-overlay` with subtle border on left
- Header: card word + "AI Explanation" label + close button
- Content: streamed Markdown rendered with light prose styles
- Never blocks the card itself — the card remains visible behind/beside the panel

---

## 8. Interaction Design

### 8.1 Review Session Keyboard Shortcuts

The entire review session must be usable without a mouse.

| Key | Action |
|---|---|
| `Space` or `Enter` | Show answer (front → back) |
| `1` | Rate: Again |
| `2` | Rate: Hard |
| `3` | Rate: Good |
| `4` | Rate: Easy |
| `E` | Open AI Explanation panel |
| `Escape` | Close AI panel / close dialog |

A persistent keyboard shortcut hint appears at the bottom of the review card, collapsible after the first 5 sessions (stored in localStorage).

### 8.2 Gesture Support (Mobile)

| Gesture | Action |
|---|---|
| Tap card | Show answer |
| Swipe left | Rate: Again |
| Swipe right | Rate: Easy |
| Swipe up | Rate: Good |
| Long press | Open card detail / edit |

Swipe thresholds: 80px minimum distance, 300ms maximum duration. Visual feedback during swipe: card rotates slightly (max 8deg) and a rating label appears with the appropriate color.

### 8.3 Optimistic UI

All review submissions update the UI immediately before the API responds. The queue advances to the next card within 100ms of a rating button press. If the API call fails:
- The card is silently re-queued to the end of the session
- A non-intrusive toast notifies the user: "One card will be re-reviewed"
- The failure is logged for batch retry (see TDD §10)

### 8.4 Loading States

- **Initial page load:** Skeleton loaders that match the layout of the actual content (not generic spinners)
- **AI generation:** Streaming text with a subtle pulsing cursor — never a spinner
- **Review queue load:** Skeleton card displayed for max 200ms; if data arrives sooner, no skeleton appears (threshold prevents flash)
- **Deck list:** Staggered card fade-in (50ms delay per card) on first load only

### 8.5 Toast Notifications

Toasts appear bottom-center on desktop, bottom-full-width on mobile. They auto-dismiss after 4 seconds. Maximum 2 visible at once.

| Type | Color | Usage |
|---|---|---|
| Info | Primary | "Card added to deck" |
| Success | Success | "Session complete! 45 cards reviewed." |
| Warning | Warning | "3 leeches detected — tap to review" |
| Error | Danger | "Failed to save. Will retry automatically." |

Never use toasts for information the user needs to act on immediately. Use dialogs for those cases.

---

## 9. Japanese Text Rendering

### 9.1 Furigana

Furigana (reading guides above kanji) is rendered using the HTML `<ruby>` element. The `<FuriganaText>` component accepts a string in the format `漢字[かんじ]` and outputs proper `<ruby><rt>` markup.

- Furigana is shown by default on example sentences for N5–N3 cards
- For N2–N1 cards, furigana is hidden by default with a toggle to reveal
- For Beyond JLPT cards, furigana is always available via tap/hover on individual kanji

### 9.2 Vertical Text

Vertical text (`writing-mode: vertical-rl`) is used sparingly — only in specific card types for classical Japanese or when explicitly requested. Never in the main UI chrome.

### 9.3 Line Breaking

- `word-break: keep-all` on Japanese sentences to prevent mid-word breaks
- `overflow-wrap: anywhere` as a fallback
- Avoid `white-space: nowrap` on Japanese text blocks

### 9.4 IME Handling

Search fields and card input fields must handle IME composition correctly:
- Do not submit on `keydown` Enter if `event.isComposing === true`
- Show a subtle "Composing..." indicator in the input when IME is active
- Accept both hiragana and romaji input in search (convert romaji to hiragana for matching)

### 9.5 Font Rendering

- `-webkit-font-smoothing: antialiased` globally
- For Japanese text at small sizes (below 14px), `text-rendering: optimizeLegibility` for better kana rendering
- Always load Noto Sans JP weight 400 and 700; avoid intermediate weights for CJK which may not render consistently across platforms

---

## 10. Accessibility Standards

### 10.1 Target Compliance

WCAG 2.1 Level AA is the minimum. Strive for AAA where practical, particularly for color contrast.

### 10.2 Color Contrast

| Combination | Minimum Ratio | Target |
|---|---|---|
| Body text on background | 4.5:1 | 7:1 |
| Large text (18px+ bold) | 3:1 | 4.5:1 |
| UI components & borders | 3:1 | 4.5:1 |
| Rating button text | 4.5:1 | 7:1 |

All color combinations must be verified with a contrast checker when modifying the palette. The rating button colors (§4.4) are pre-verified against white labels.

### 10.3 Keyboard Navigation

- All interactive elements reachable via `Tab` in logical DOM order
- Focus ring always visible — never `outline: none` without a custom replacement
- Focus ring style: `box-shadow: 0 0 0 3px var(--color-primary-200)` (see §2.3)
- Review session fully operable via keyboard (§8.1)
- Modals and drawers trap focus while open; return focus to trigger on close

### 10.4 Screen Readers

- All images and icons have `alt` text or `aria-label`
- Japanese text elements carry `lang="ja"` attribute so screen readers use the correct pronunciation engine
- Dynamic content updates (new card displayed after rating) announce via `aria-live="polite"` on the review container
- Rating buttons announce their full label and the interval preview: "Good, 3 days" not just "3"
- FSRS stats and numbers are accompanied by human-readable context: "Stability: 4.7 days" not just "4.7"

### 10.5 Motion Sensitivity

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

The card transition (front → back), swipe gestures, and staggered list animations are replaced with instant state changes when reduced motion is preferred.

### 10.6 Focus Management

- When a dialog opens, focus moves to the first focusable element inside it
- When a dialog closes, focus returns to the element that opened it
- When the review card advances to the next card, focus is programmatically set to the card's "Show Answer" button

---

## 11. Responsive Behavior

### 11.1 Breakpoints

| Breakpoint | Token | Width | Layout Change |
|---|---|---|---|
| Mobile | `sm` | < 640px | Single column, no sidebar, bottom nav |
| Tablet | `md` | 640px–1024px | Sidebar collapses to icon-only |
| Desktop | `lg` | 1024px–1280px | Full sidebar, standard layout |
| Wide | `xl` | > 1280px | Content max-width applies, sidebar fixed |

### 11.2 Mobile-Specific Considerations

- Bottom navigation bar replaces sidebar on mobile (max 4 items: Review, Decks, Analytics, Settings)
- Review cards use full viewport height with safe-area insets for notched devices
- Rating buttons are sticky at the bottom on mobile with increased tap target size (min 56px height)
- All modals become full-screen bottom sheets on mobile
- Swipe gestures (§8.2) replace keyboard shortcuts as the primary rating mechanism on mobile

### 11.3 Touch Targets

All interactive elements on mobile meet the 44×44px minimum touch target size (Apple HIG). For smaller visual elements (badges, tags), the clickable area is padded invisibly to meet this requirement.

---

## 12. Motion & Animation

### 12.1 Duration Tokens

| Token | Duration | Usage |
|---|---|---|
| `duration-instant` | 75ms | Micro-feedback (button press) |
| `duration-fast` | 150ms | State transitions (hover, focus) |
| `duration-normal` | 250ms | Component transitions (card flip, panel open) |
| `duration-slow` | 400ms | Page transitions, large layout changes |
| `duration-deliberate` | 600ms | Onboarding animations, celebration moments |

### 12.2 Easing Tokens

| Token | CSS Value | Usage |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Most transitions |
| `ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering the screen |
| `ease-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving the screen |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful bounces (use sparingly) |

### 12.3 Specific Animations

**Card reveal (front → back):** The card content below the word slides down with `ease-decelerate` at `duration-normal`. The word remains in place. No 3D flip.

**Rating button feedback:** On press, scale to 0.96 over `duration-instant`, then spring back over `duration-fast`.

**Session complete:** A brief celebration state — the progress bar fills to 100% with a pulse, followed by a smooth transition to the summary screen. No confetti or excessive animation.

**AI panel open:** Slides in from the right with `ease-decelerate` at `duration-normal`. Content streams in progressively.

**Leech flag:** The card briefly flashes a red border (2 cycles, `duration-deliberate` total) when flagged as a leech. Draws attention without being alarming.

---

## 13. Dark Mode

### 13.1 Implementation

Dark mode is implemented via CSS custom properties (tokens). A `data-theme="dark"` attribute on the `<html>` element switches all semantic tokens to their dark values (§4.3). `prefers-color-scheme` is respected by default; users can override it in Settings.

### 13.2 Dark Mode Specific Rules

- Japanese text at small sizes may need slightly higher `letter-spacing` in dark mode for legibility on certain displays — add `0.01em` to `text-xs` Japanese text in dark mode
- Elevation in dark mode is expressed through **lightness** rather than shadow — higher surfaces are slightly lighter neutrals, not darker
- The review card in dark mode uses `neutral-800` as the card surface, not `neutral-900`, to avoid the card blending into the page background
- The JLPT level badge colors (§4.5) need dark-mode variants — replace the light backgrounds with 20% opacity versions of the same hue

### 13.3 Dark Mode Palette Additions

The neutral scale adds one additional step for dark mode elevation:

```
--color-neutral-850: #18202F   ← between 800 and 900, used for inset surfaces in dark
```

---

## 14. Onboarding Experience

### 14.1 Principles

Onboarding must get a new user to their first review within 5 minutes. Every screen that doesn't directly move toward that goal is a screen to cut or defer.

### 14.2 Onboarding Flow

```
Sign Up (/signup)
      ↓
Email Verification (VerifyView — inline at /signup, URL does not change)
(6-digit OTP — entered on the same device, no device switch required)
      ↓
Step 1: What's your current level?  (/onboarding/level)
(6 options: Complete Beginner / N5 / N4 / N3 / N2 / N1+)
      ↓
Step 2: What's your goal?  (/onboarding/goal)
(4 options: Pass JLPT / Enjoy anime & manga / Read novels / Live/work in Japan)
      ↓
Step 3: What are your interests?  (/onboarding/interests)
(Multi-select chips: Anime, Gaming, Food, Business, Travel, Music, Sports, Tech)
      ↓
Step 4: How much time per day?  (/onboarding/schedule)
(3 options: ~5 min (light) / ~15 min (steady) / ~30 min+ (intensive))
      ↓
Recommended Decks Screen  (/onboarding/decks)
(App recommends 2–3 premade decks based on level + goal. User can swap any.)
[Add all recommended decks →]
      ↓
Dashboard (/dashboard)
(First review session is immediately available)
```

### 14.3 Onboarding UI Rules

- Each step fits on a single screen with no scrolling required
- Progress is shown as a simple step indicator (e.g. "2 of 5") — the OTP screen is shown as step 0 or a pre-step so the numbered indicator begins at step 1 once the user is verified
- Every onboarding step has a "Skip" option that uses sensible defaults
- The OTP screen is lightweight and appears directly after signup submission — it must not feel like a wall; copy should frame it as a quick security step, not a mandatory bureaucratic gate
- The recommended decks screen shows real card previews (the first card from each deck) so users see the quality of content before committing

### 14.4 Email Verification: Tomo OTP Input Component

The 6-digit OTP input is a first-class Tomo design system component used in the `VerifyView` component rendered inline at `/signup`. It must feel fast, frictionless, and visually calm.

#### Component Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              Check your email                                       │
│              We sent a 6-digit code to you@example.com             │
│                                                                     │
│         ┌───┐  ┌───┐  ┌───┐     ┌───┐  ┌───┐  ┌───┐              │
│         │ 4 │  │ 8 │  │ _ │     │   │  │   │  │   │              │
│         └───┘  └───┘  └───┘     └───┘  └───┘  └───┘              │
│                  ↑ active digit                                     │
│                                                                     │
│              Didn't receive it?  [Resend code →]                   │
│              (available after 60 second cooldown)                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Interaction Behaviour

- **6 individual `<input type="text" inputmode="numeric" maxlength="1">` elements** — one per digit — grouped with a visible gap after digit 3 (mirroring the 3+3 visual grouping used for confirmation codes in most email clients)
- Auto-advance: focus moves to the next input as soon as a digit is entered; backspace on an empty input moves focus left
- **Paste handling:** pasting the full 6-digit string fills all inputs and auto-submits — covers the common case of tapping "Copy code" from the notification banner
- On mobile, `inputmode="numeric"` shows the numeric keyboard automatically — no need to switch keyboards
- Auto-submit fires as soon as all 6 digits are present — the user never needs to press a confirm button in the happy path
- If the code is invalid, all 6 inputs animate a horizontal shake (`ease-spring`, 3 cycles, 300ms total) and clear; focus returns to the first input

#### Visual Spec

| Property | Value |
|---|---|
| Digit box size | 52×60px (desktop), 44×52px (mobile) |
| Border | `1px solid color-border-default` at rest; `color-accent` when focused |
| Font | JetBrains Mono, `text-2xl`, weight 600 (monospace for visual alignment) |
| Gap between boxes | `space-2` (8px); `space-4` (16px) after the third digit |
| Error state border | `color-danger-500`, 2px |
| Corner radius | `radius-md` (10px) |

#### Resend Cooldown

A "Resend code" link appears below the inputs. It is disabled for 60 seconds after the initial send (a live countdown is shown: "Resend in 42s"). After the cooldown, tapping it calls `supabase.auth.resend({ type: 'signup', email })` and resets the countdown.

### 14.5 Device Breakage Prevention

**What is device breakage?**

Device breakage occurs when a user starts signup on one device/browser, receives a magic link email, and opens that link on a different device (e.g. tapping the email notification on their phone while the signup page is open on their desktop). The magic link creates an authenticated session on the second device — but the original device never receives that session, leaving the user stuck.

**Why the 6-digit OTP eliminates this**

The OTP is typed directly into the `/signup/verify` page on the same device and browser where signup began. The session is established in that browser's cookie jar. No cross-device handoff occurs. The pattern is the same as a bank or e-commerce OTP — universally understood by users and inherently device-scoped.

**UX copy guidelines for the OTP screen**

- Headline: "Check your email" — not "Verify your account" (framing: action, not bureaucracy)
- Subtext: "We sent a 6-digit code to [email]. It expires in 1 minute." — set expectations without alarm
- Error state: "That code didn't work. Check the email and try again, or request a new code." — give the user a clear path, never a dead end
- Never say "magic link" anywhere — it is a source of confusion for users who don't know the term

---

*End of UX/UI Design Specification v1.0.0*
