# Design Brief: Dashboard Navigation Redesign (Sidebar + Mobile Drawer)

**Status:** Confirmed by user on 2026-05-09; revised on 2026-05-09 after the DESIGN.md cleanup pass committed the card-stack identity, the 2px Inari Vermillion top stripe as THE brand device, the Two-Family typography rule (Bricolage Grotesque display + DM Sans body), and the Flat-Card Rule. The revision tightens three axes (sidebar surface, section-label typography, active-row stripe) without unwinding any prior decision. Implementation pending.
**Origin:** `$impeccable shape` run for the dashboard sidebar + mobile nav redesign with custom SVG icons; revised via `$impeccable shape` after DESIGN.md was consolidated to a single-current-truth spec.
**Register:** product (per PRODUCT.md).
**Source of truth:** PRODUCT.md (brand voice, identity surfaces, anti-references) and the cleaned-up DESIGN.md (the card-stack identity, the §Icon System spec, the Two-Family typography rule, the Flat-Card Rule, the cool-page / warm-card surface contract).

---

## 1. Feature Summary

The desktop **Sidebar** (288px, lg+) and **MobileDrawer** (85vw, < lg) get a brand-aligned redesign that **preserves their three-zone scaffold** (brand strip → section-grouped nav body → account strip) and information architecture (Practice / Library / Insights), while extending the codified card-stack identity into product chrome on three axes:

1. **The sidebar surface becomes Warm Paper Raised (`#FDFBF7`)** — the same warm-paper card surface used elsewhere. The sidebar reads as "a tall panel of card material at the left edge of a cool desk." Its visual contrast against the cool-paper page is identical to a card's contrast.
2. **Active nav rows pick up the 2px Inari Vermillion top stripe** — the brand's codified identity device. Each active row reads as a small card brought forward; the stripe draws in left-to-right during route-change, leading the rest of the settle. The chrome's visual language is now a sub-dialect of the card system, not a separate vocabulary.
3. **Section labels move to Bricolage Grotesque at ~11px (sentence case)** — a small typographic moment that gives the chrome editorial character at section breaks without competing with content.

The kanji-glyph icon language is replaced by a **custom geometric ink-stroke SVG set** (per §Icon System in DESIGN.md). The active state is pulled back from full-saturation Inari Vermillion to Vermillion Wash + Inari Vermillion text/icon (correcting a current `nav-item.tsx` drift past the Vermillion Tax Rule). **Choreographed hover and route-change motion** delivers the "bold and playful" energy: stroke-draw on icons, stripe-draw left-to-right on route change, and a four-beat settle that ties chrome motion back to the card identity.

The chrome stays quiet at rest; joy lives in the interaction, not in the volume.

## 2. Primary User Action

**Navigate confidently between destinations.** A learner at 7am with coffee should be able to (a) see where they are in one glance, (b) trust the nav not to compete with the content, and (c) feel a small considered reward when they tap a row — the icon strokes drawing in vermillion, the row settling into its active wash. The act of moving through the app should feel like a satisfying small ritual, not a transactional click.

## 3. Design Direction

- **Color strategy:** **Restrained**. The sidebar lives under PRODUCT.md's Vermillion Tax Rule — the default answer to "should this be red?" is "no." Inari Vermillion appears in exactly five places on the chrome: the Logo mark (brand strip), the **2px top stripe on the active nav row** (the brand's identity device extended into chrome), active-row icon + label, the account-avatar disc, and the focus halo. Most pixels stay Warm Paper Raised (sidebar surface) / Sumi Ink (text) / Faded Sumi (secondary text and resting icons).
- **Theme scene sentence:** *Sergei is at his desk at 7:04am, coffee steaming, the room calm and bright. He glances at the left edge of the screen to confirm he's on Review before he taps into the session.* Light forces itself; dark would clash with the morning-ritual register, and the cool-page-warm-card visual contract already does the "tool surface" work.
- **Named anchors:** **DESIGN.md's card-stack identity** (the sidebar is made of the same warm-paper material as cards; active rows borrow the 2px Inari Vermillion top stripe — chrome speaks the same visual language as the system's hero element); **Linear's sidebar** (warm minimal nav with motion personality, but Tomo-warmer); **iA Writer's paper-first quiet** (a tool that respects the morning). The kitsune mark + wordmark at the top is the connective tissue back to the brand register.
- **Per-surface override:** the sidebar elevates from "neutral chrome" to "card-material chrome" — its surface uses Warm Paper Raised (the card-surface token) instead of a distinct chrome neutral. This is a deliberate participation in the card-stack identity; chrome and cards now share visual material, with cards distinguished by the full anatomy (2px corner, full-perimeter border, top stripe) and the sidebar distinguished by being a tall always-on panel with a single right-edge border.

## 4. Scope

- **Fidelity:** production-ready.
- **Breadth:**
  - Desktop Sidebar (`apps/web/app/(app)/_components/sidebar.tsx`) — surface bg shifts to Warm Paper Raised
  - MobileDrawer (`apps/web/app/(app)/_components/mobile-drawer.tsx`) — surface bg shifts to Warm Paper Raised
  - NavItem (`apps/web/app/(app)/_components/nav-item.tsx`) — active-state rebuild (top stripe + Vermillion Wash row + vermillion text), four-beat route-change settle motion, hover stroke-draw wiring
  - NavSection (`apps/web/app/(app)/_components/nav-section.tsx`) — Bricolage Grotesque label typography (~11px sentence case), hairline divider above non-first sections
  - UserMenu (`apps/web/app/(app)/_components/user-menu.tsx`) — replace 私/設/報/出 kanji glyphs with new icon set (Profile / Settings / ReportBug / SignOut from the new icon set)
  - **New custom geometric ink-stroke icon set** (~9 icons): Dashboard, Review, Decks, Browse, Analytics, Profile, Settings, ReportBug, SignOut. Drawn to the §Icon System contract in DESIGN.md.
  - Optional: OfflineQueueBadge (`apps/web/app/(app)/_components/offline-queue-badge.tsx`) re-style to ink-stroke pill if it visually clashes with the new icon language and the active-row top stripe
  - **Bundled (per Open Question 6)**: TopBar (`apps/web/app/(app)/_components/top-bar.tsx`) surface bg shifts to Warm Paper Raised so the sidebar/topbar corner is continuous card-material rather than a Cream Inset / Warm Paper Raised handoff
- **Interactivity:** shipped components; four-beat choreographed route-change motion (stripe → wash → icon stroke → label color) fully wired; hover stroke-draw + row tint with ~50ms icon-leads-row stagger; touch devices get a tighter ~250ms settle keyed off `(hover: hover)` media query.
- **Time intent:** polish until it ships.

## 5. Layout Strategy

**Architecture is preserved** (per the user's "keep most of the structure" ask):

| Zone | Desktop Sidebar | MobileDrawer |
|---|---|---|
| Top | h-16 brand strip with Logo + Tomo wordmark; soft-hairline bottom border | h-16 brand strip + close button (`×`) |
| Middle | flex-1 scroll-area; section-grouped nav (Practice / Library / Insights) | identical structure |
| Bottom | UserMenu account strip; soft-hairline top border | identical structure |

The change is **texture, type, and motion, not topology**. Pill-row geometry stays (icon + label + optional badge), sub-nav indent stays (Decks → Browse), section grouping stays (Practice / Library / Insights).

**Visual rhythm shifts that *do* land:**

- **Page background = Cool Paper Base** (`#F4F1EC`, the tool-surface token in `globals.css`).
- **Sidebar / drawer surface = Warm Paper Raised** (`#FDFBF7`) — the same warm-paper-card surface used elsewhere in the system. The sidebar reads as a tall panel of card material at the left edge of a cool desk; its contrast against the cool-paper page is identical to a card's contrast. This unifies the chrome with the system's visual hero (the card) without making the sidebar a literal card. Note: the sidebar is *not* a card by Tomo's definition — it has no 2px corner, no top stripe, and only one border (the right edge running floor-to-ceiling). It's a panel made of card material, structurally distinct from a card primitive.
- **Section labels move to Bricolage Grotesque at ~11px** (`text-xs font-medium`), sentence case (`Practice` / `Library` / `Insights`, not `PRACTICE` / `LIBRARY` / `INSIGHTS`), Faded Sumi color, looser tracking (~0.04em). This is a small typographic personality moment in chrome — the section breaks read as confident editorial dividers rather than utility labels.
- **Section dividers above non-first sections** (1px Soft Hairline, `mx-3`) are preserved as editorial punctuation. With Bricolage labels above, the divider + label pair gives each section break two beats of typographic moment without becoming loud.
- **The brand strip retains its current treatment**: Logo at the committed sizing + Tomo wordmark + 1px Soft Hairline bottom border separating the brand strip from the nav body. The brand strip sits flush against the sidebar's top edge with no top stripe of its own (the Logo carries the brand identity in this position; an additional vermillion stripe would compete).
- **TopBar surface (out-of-scope but flagged)**: with the sidebar moving to Warm Paper Raised, the existing `bg-cream-inset` TopBar will produce a visual discontinuity at the sidebar/topbar corner. Either move TopBar to Warm Paper Raised (forming a continuous L-shape of card material) or accept the discontinuity. See Open Questions.

## 6. Key States

| State | Visual | Motion |
|---|---|---|
| **Default (resting row)** | Transparent bg; Sumi Ink label at base/medium; Faded Sumi 1.75px-stroke icon | None |
| **Hover** | Cream Inset row tint; icon strokes redraw + tint to Inari Vermillion (`currentColor`) | Icon `stroke-dasharray` draw-on, 250ms ease-out-quart; row tint fades in 200ms; icon leads row by ~50ms |
| **Active (current page)** | **2px Inari Vermillion top stripe** + Vermillion Wash row bg + Inari Vermillion icon + label; label weight bumps to semibold. The row reads as a small card brought forward — the top stripe is the same brand identity device that sits on the system's full-size cards. | One-shot settle on route mount (see below) |
| **Active + route-change settle (4 beats)** | Same end-state as Active, but performed sequentially | **Beat 1** (0–200ms): top stripe draws in left-to-right via `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)`, ease-out-quart. The brand identity arrives first. **Beat 2** (50–300ms): row Vermillion Wash bg fades in, ease-out-quart. The card-shape settles beneath the stripe. **Beat 3** (150–450ms): icon stroke draws via `stroke-dashoffset`, ease-out-quart. **Beat 4** (200–400ms): label color transitions Sumi Ink → Inari Vermillion, font-weight medium → semibold. Total settle ~450ms; one-shot, no looping. |
| **Focus (keyboard)** | 3px Vermillion Wash halo (existing `--shadow-focus` token) on the row's full bounding box (does not include the top stripe — the stripe is part of the active state's identity, not the focus state) | Halo fades in 100ms |
| **Sub-nav expanded** | Caret rotates 90°; child rows revealed via `grid-template-rows` transition. When a child route is active, the *child row* gets the active treatment (top stripe + Vermillion Wash bg + vermillion text), the parent row stays inactive. | Existing 250ms ease-out preserved |
| **OfflineQueueBadge** | Existing floating dot/count on Review row, kept (re-style to ink-stroke pill if needed — see Open Questions) | Existing pulse on count change |
| **Reduced motion** | All visual states identical (stripe, wash, vermillion text/icon all in their static end-state on the active row) | Stripe-draw, row tint, icon stroke-draw, label transition, halo all become instant. Drawer slide becomes instant. |
| **Drawer closed (mobile)** | Hamburger ☰ in TopBar | Tap → 250ms transform slide-in |
| **Drawer open (mobile)** | Focus trapped, scroll locked, backdrop sumi-ink/40 | Existing behavior preserved verbatim |

## 7. Interaction Model

- **Hover → click on desktop:** pointer enters → icon draws on + row tints → user clicks → link fires immediately, no artificial press feedback. Browser navigates. Destination layout mounts. The newly-active row plays its one-shot settle. The route change *is* the feedback.
- **Tap on mobile:** drawer slide-in → user taps row → drawer closes first (250ms) → navigation completes → new active row settles on mount. (Existing close-then-navigate sequencing in `nav-item.tsx`'s `onNavigate` handler is preserved.)
- **Account menu:** avatar-row tap → popover above the strip. Items have row hover wash; sign-out gets danger-ghost treatment (Vermillion Wash bg, Vermillion Deep text). Click-outside, Escape, and item-selection all close.
- **Sub-nav** (Decks → Browse): caret button is a separate hit target from the link (existing pattern). Caret rotates 90° on expand (200ms ease-out). Sub-rows fade in via grid-template-rows transition.
- **Reduced motion** end-to-end: every animation reduces to instant. The active-row end state (top stripe + Vermillion Wash bg + vermillion text/icon + bold label) is preserved verbatim — it's static visual, not motion. The four-beat route-change settle collapses to a single instantaneous state change.

## 8. Content Requirements

### Custom geometric ink-stroke icon set

**The icon system contract is fully specified in DESIGN.md → §Icon System.** Implementation follows that spec verbatim. Summary for orientation: 24×24 viewBox, 1.75px stroke at 24px (proportional at other sizes per the `N / 13.7` scaling rule), round linecap and linejoin, no fills (or single solid silhouette fills only when meaningful), `currentColor`, inline React components in `apps/web/components/icons/IconName.tsx`, and `pathLength="100"` on every animatable path.

The icon set required by this brief — Dashboard, Review, Decks, Browse, Analytics, Profile, Settings, ReportBug, SignOut — must be drawn to that contract. See DESIGN.md → §Icon System → "How to Draw a New Icon" for the 11-step procedure.

### Icon inventory

| Icon | Concept | Composition |
|---|---|---|
| **Dashboard** | Hi-no-maru disc on a horizon line | Circle (filled in active, outlined in default) sitting on a horizon stroke. Reads as morning sunrise, ties back to the morning-ritual register. |
| **Review** | Cycle/return | Open arc-arrow that curves around and ends in a small terminal arrowhead. Single continuous path. |
| **Decks** | Card stack | Three offset rectangles in outline, top card slightly forward and slightly tilted. Echoes the card-stack identity from auth/onboarding. |
| **Browse** | Open magnifier | Just a circle and a short outside line (no diagonal handle). Reads as "look closer," editorially refined. |
| **Analytics** | Growing bars | Three vertical bars at incremental height. Tallest bar terminates in a filled dot (editorial accent). |
| **Profile** | Quiet figure | Small head silhouette + shoulders curve, single continuous path. No torii (too cultural-specific for a generic "user"). |
| **Settings** | Ink-stroke gear | Five round-terminal spokes drawn as ink strokes (not a filled cog). Center hole is a small circle. (At ≤16px, falls back to a three-spoke variant — see Open Questions.) |
| **Report a bug** | Raised flag | Single vertical line + rectangle outline above. Reads as "raise a flag," not a literal beetle. |
| **Sign out** | Doorway with arrow | Open doorway (rectangle missing right edge) + a small arrow leaving from inside. Arrow is the only filled element. |

### Section labels (revised)

Practice / Library / Insights — sentence case, **Bricolage Grotesque** at `text-xs` (~11px), `font-medium`, looser tracking (~0.04em), Faded Sumi color. The chrome's small typographic personality moment; the section labels read as confident editorial dividers rather than utility small-caps.

Each non-first section is preceded by a 1px Soft Hairline divider (`mx-3 h-px bg-soft-hairline`) above the label. The divider + Bricolage label pair gives each section break two beats of typographic moment without becoming loud.

Implementation note: this is the only place in chrome where Bricolage Grotesque appears at small size. Brand-strip labels (the "Tomo" wordmark) and large display moments use Bricolage at their committed sizes; body and chrome text otherwise stays in DM Sans.

### Nav row labels (preserved)

Dashboard, Review, Decks, Browse, Analytics. No change.

### Account menu (preserved labels, new icons)

Profile, Settings, Report a bug, Sign out. Each gains a custom SVG icon from the set above (replacing the current 私/設/報/出 kanji glyphs in `user-menu.tsx`).

### No copy added to chrome

Per PRODUCT.md Principle 6 (*"Tomo never speaks in copy, never narrates progress, never appears in normal review chrome"*), no tooltips, no microcopy, no "Welcome back" greetings live in the sidebar. The TopBar continues to carry per-page titles.

## 9. Recommended References

- **`motion-design.md`** — for the icon-stroke draw-on (`stroke-dasharray`), the row-tint slide-in, the route-change settle choreography, and the cause-and-effect lead/lag between icon and row.
- **`interaction-design.md`** — for the sub-nav expansion, account popover focus management, drawer trap, and the route-change-then-settle handoff.
- **`responsive-design.md`** — for the lg breakpoint switch from drawer to sidebar; touch-target sizing in the drawer; close-then-navigate sequence on mobile.
- **`spatial-design.md`** — for the three-zone vertical rhythm and section spacing; warm-vs-cool surface contrast at the sidebar edge.
- **`color-and-contrast.md`** — for verifying Vermillion Wash row + Inari Vermillion text + Inari Vermillion icon clears WCAG AA at the small icon stroke weight; verifying focus halo against Cream Inset.

## 10. Open Questions

1. **OfflineQueueBadge re-style.** The existing pulse/count behavior is fine, but the visual currently floats over the kanji glyph. With ink-stroke icons, should the badge sit as a **small ink-stroke pill counter** (e.g., `5` in a stroke-only rectangle) so the chrome stays consistent in vocabulary? With the active-row top stripe added, the badge on an active Review row also needs to coexist with the stripe — the badge's position should clear the stripe (sit below it, not crossing it). **Default: re-style to ink-stroke pill; position below the stripe on active rows.**
2. **Settings icon at small sizes.** A five-spoke ink-stroke gear at 16px (the size in the account popover) may visually collapse. Fall back to a three-spoke variant at <20px, or use a different glyph entirely (a slider track + handle)? Implementation will resolve via optical testing.
3. **Hover interaction on touch devices.** The icon-draw-then-tint hover is delightful with a pointer but can't fire on touch. Should the touch active-row settle play faster (~250ms total instead of ~450ms) so taps feel immediate while pointer hover/route-change plays at the canonical four-beat timing? **Default: yes, keyed off `(hover: hover)` media query — the mobile drawer's already-tap-and-close pattern benefits from a tighter settle.**
4. **Logo sizing in the new brand strip.** With the sidebar surface moving to Warm Paper Raised (matching card material), the brand strip now sits flush against the system's hero surface color. The current `Logo size={48} wordmarkSize="lg"` may want to drop slightly (40px) to give the new Bricolage section labels below it more headroom. Worth a visual check during craft.
5. **Brand strip top stripe.** The brand strip is the topmost zone of the sidebar. Should it carry its own 2px Inari Vermillion top stripe (so the sidebar opens with the brand identity device at its absolute top edge) or stay clean (Logo carries identity in this position)? Adding a stripe to the brand strip + active rows could read as "every important moment in the sidebar is a card." **Default: skip the brand-strip stripe; the Logo and the warm-paper surface already carry brand presence.** Worth a craft-time visual check.
6. **TopBar surface.** The sidebar moves to Warm Paper Raised. The existing `bg-cream-inset` TopBar will produce a visual discontinuity at the sidebar-TopBar corner on lg+. Two options: (a) move TopBar to Warm Paper Raised so the chrome forms a continuous L-shape of card material; (b) keep TopBar at Cream Inset and accept the visual handoff at the corner as "two distinct chrome surfaces meeting." **Default: option (a) — extend Warm Paper Raised to the TopBar in the same craft pass; the L-shape is visually clean and reinforces the cool-page-warm-chrome contract.** This is technically out of scope for nav redesign but should be bundled.
7. **Card-stripe motion direction on RTL.** The route-change settle's beat 1 has the top stripe drawing left-to-right. For future RTL support (Japanese learner audience may include some RTL contexts when the app supports Arabic / Hebrew teaching content), should the draw direction mirror to right-to-left under `[dir="rtl"]`? Out of scope for this PR but flagged for the i18n pass.
8. **Active stripe on indented sub-nav rows.** When the active route is a sub-nav child (e.g., `/decks/browse`), the *child row* gets the active treatment per the brief's Sub-nav state. Does the stripe on a sub-nav child row span the full sidebar width, or only the indented row's box? Spanning full width visually unifies the sub-nav as part of its parent's territory; spanning only the indented row reads as honest "the active card is the nested one." **Default: span full width for visual consistency with top-level rows.** Worth a visual check during craft — at narrow indented widths the stripe-width truncation may look better.
