# Information Architecture & Wireframe Guide
## AI-Enhanced FSRS for Japanese

**Version:** 1.3.0  
**Status:** Active  
**Last Updated:** 2026-04-28

---

## Table of Contents

1. [Site Map](#1-site-map)
2. [App Router Structure](#2-app-router-structure)
3. [Navigation Architecture](#3-navigation-architecture)
4. [Page Wireframes](#4-page-wireframes)
5. [Component Spatial Map](#5-component-spatial-map)
6. [User Flows](#6-user-flows)
7. [Data Display Patterns](#7-data-display-patterns)

---

## 1. Site Map

The complete route map of the application. All routes under `(app)` require authentication.

```
/                               ← Landing page (public)
├── /login                      ← Sign in
├── /signup                     ← Create account + inline OTP verification (URL stays at /signup; view flips in-component)
│   └── /signup/verify          ← Redirect stub → /signup (middleware guard only; not a user-facing page)
├── /onboarding                 ← First-time setup flow (post-signup, requires auth)
│   ├── /level                  ← Step 1: Current level
│   ├── /goal                   ← Step 2: Study goal
│   ├── /interests              ← Step 3: Interests
│   ├── /schedule               ← Step 4: Daily time
│   └── /decks                  ← Step 5: Recommended decks
│
└── /app  (protected)
    ├── /dashboard              ← Home: due count, streaks, quick review
    │
    ├── /review                 ← Review session hub
    │   ├── /review/session     ← Active review session (full-bleed)
    │   └── /review/summary     ← Post-session results
    │
    ├── /decks                  ← All decks (personal + premade subscriptions)
    │   ├── /decks/browse       ← Premade deck catalogue
    │   └── /decks/[id]         ← Individual deck view
    │       ├── /decks/[id]/cards          ← Card list & manager
    │       ├── /decks/[id]/cards/new      ← Add card manually
    │       └── /decks/[id]/cards/[cardId] ← Card detail & edit
    │
    ├── /analytics              ← Progress & stats
    │   ├── /analytics/overview ← Summary stats
    │   ├── /analytics/forecast ← Review forecast
    │   └── /analytics/jlpt     ← JLPT gap analysis
    │
    └── /settings               ← User preferences
        ├── /settings/profile
        ├── /settings/study
        ├── /settings/notifications
        └── /settings/account
```

---

## 2. App Router Structure

The Next.js 15 App Router implementation that maps to the site map above.

```
app/
│
├── layout.tsx                         ← Root layout: fonts, providers, theme
├── page.tsx                           ← Landing page
│
├── (auth)/                            ← Route group: no sidebar, centered layout
│   ├── layout.tsx                     ← Auth layout: centered card, no nav
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       ├── page.tsx               ← Signup form + VerifyView (OTP entry inline via state flip; URL stays at /signup)
│       └── verify/
│           └── page.tsx           ← redirect('/signup') — middleware guard stub only
│
├── onboarding/                        ← Onboarding (its own layout, no sidebar)
│   ├── layout.tsx                     ← Progress bar, step indicator, no nav
│   ├── page.tsx                       ← Redirects to /onboarding/level
│   ├── level/page.tsx
│   ├── goal/page.tsx
│   ├── interests/page.tsx
│   ├── schedule/page.tsx
│   └── decks/page.tsx
│
└── (app)/                             ← Route group: authenticated, with sidebar
    ├── layout.tsx                     ← App shell: sidebar + topbar + main area
    │
    ├── dashboard/
    │   └── page.tsx
    │
    ├── review/
    │   ├── page.tsx                   ← Review hub / session chooser
    │   ├── session/
    │   │   └── page.tsx               ← Full-bleed review (no sidebar)
    │   └── summary/
    │       └── page.tsx
    │
    ├── decks/
    │   ├── page.tsx                   ← Deck list
    │   ├── browse/
    │   │   └── page.tsx               ← Premade deck catalogue
    │   └── [id]/
    │       ├── page.tsx               ← Deck overview
    │       ├── loading.tsx            ← Deck skeleton loader
    │       └── cards/
    │           ├── page.tsx           ← Card list
    │           ├── new/
    │           │   └── page.tsx       ← Add card form
    │           └── [cardId]/
    │               └── page.tsx       ← Card detail
    │
    ├── analytics/
    │   ├── layout.tsx                 ← Analytics tab nav
    │   ├── page.tsx                   ← Redirects to /overview
    │   ├── overview/page.tsx
    │   ├── forecast/page.tsx
    │   └── jlpt/page.tsx
    │
    └── settings/
        ├── layout.tsx                 ← Settings sidebar nav
        ├── page.tsx                   ← Redirects to /profile
        ├── profile/page.tsx
        ├── study/page.tsx
        ├── notifications/page.tsx
        └── account/page.tsx
```

### 2.1 Special Layout Notes

- **`(app)/review/session/`** has its own full-bleed layout override — the sidebar is hidden and the viewport is fully available to the card.
- **`onboarding/`** is outside the `(app)` group deliberately — it has no sidebar and a distinct step-based layout.
- **`(auth)/`** uses a centered card layout with no navigation.
- `loading.tsx` files are added to routes with significant server data fetching to enable Next.js Suspense streaming.

---

## 3. Navigation Architecture

### 3.1 Desktop Navigation (Sidebar)

The sidebar is the primary navigation on desktop (≥1024px). It is fixed, 240px wide, and always visible except during the review session.

```
┌────────────────────────────────────────────┐
│  [Logo] FSRS Japanese          [icon] [icon]│  ← Logo, notification bell, user avatar
├────────────────────────────────────────────┤
│  📊  Dashboard                              │
│  🗂️  Decks                                  │
│  📖  Review                ← highlighted    │  ← Active route
│  📈  Analytics                              │
├────────────────────────────────────────────┤
│  ── Today's Progress ──                     │
│  Reviews Due    [badge: 42]                 │
│  Streak         [badge: 14d]                │
├────────────────────────────────────────────┤
│  ⚙️  Settings                               │
│  [avatar] User Name                         │  ← Bottom: user section
└────────────────────────────────────────────┘
```

**Collapsed sidebar (tablet, 56px):** Shows icons only. The "Today's Progress" section is hidden. Hovering an icon shows a tooltip with the route name.

### 3.2 Mobile Navigation (Bottom Bar)

On mobile (< 640px), the sidebar is replaced by a bottom navigation bar.

```
┌──────────────────────────────────────────────┐
│                                              │
│              [Page Content]                  │
│                                              │
├──────────────────────────────────────────────┤
│  🏠 Home │ 🗂️ Decks │ 📖 Review │ 📈 Stats  │
└──────────────────────────────────────────────┘
```

- 4 tabs maximum
- Review tab shows a badge with due count when > 0
- Settings is accessed via the Dashboard or a "more" menu — not a primary tab

### 3.3 Contextual Top Bar

A contextual topbar appears inside each main page. It is not a global element — each page defines its own topbar content.

```
┌────────────────────────────────────────────────────────────────┐
│  ← Back   Deck: Core Vocabulary N3      [Search] [+ Add Card]  │
└────────────────────────────────────────────────────────────────┘
```

Content varies by page:
- **Deck detail:** Deck name, card search, "Add Card" button
- **Analytics:** Page title, date range picker
- **Review session:** No topbar — replaced by session progress bar

---

## 4. Page Wireframes

Wireframes use ASCII to describe spatial layout. Each element maps to a real component. Dimensions are proportional, not pixel-accurate.

---

### 4.1 Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR                  │  MAIN CONTENT AREA                      │
│  (240px fixed)            │  (fluid, max 960px)                     │
│                           │                                         │
│  [Logo]                   │  ┌──────────────────────────────────┐  │
│                           │  │  Good morning, Alex!             │  │
│  Dashboard ←              │  │  You have 42 cards due today.    │  │
│  Decks                    │  │                   [Start Review →]│  │
│  Review                   │  └──────────────────────────────────┘  │
│  Analytics                │                                         │
│  ──────────               │  ┌────────┐ ┌────────┐ ┌────────────┐  │
│  Due: 42                  │  │ Streak │ │ Total  │ │  Retention │  │
│  Streak: 14d              │  │  14d 🔥│ │ 1,240  │ │   87.3%    │  │
│  ──────────               │  │        │ │ cards  │ │            │  │
│  Settings                 │  └────────┘ └────────┘ └────────────┘  │
│  [User]                   │                                         │
│                           │  ── Today's Review Breakdown ──         │
│                           │  ┌────────────────────────────────────┐ │
│                           │  │  [Bar chart: New / Learning /      │ │
│                           │  │   Review / Relearning counts]      │ │
│                           │  └────────────────────────────────────┘ │
│                           │                                         │
│                           │  ── Active Decks ──                     │
│                           │  ┌────────────────┐ ┌────────────────┐ │
│                           │  │ Core N3 Vocab  │ │ N2 Grammar     │ │
│                           │  │ 320 cards      │ │ 89 patterns    │ │
│                           │  │ 12 due today   │ │ 5 due today    │ │
│                           │  └────────────────┘ └────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Review Session (Full-Bleed)

The review session hides the sidebar and expands to fill the viewport. This is the most minimal screen in the app.

**Front of card (question):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Core N3 Vocab]                         [Comprehension]   ✕ End      │
│                                                                     │
│  ─────────────────────────────────────────────────                  │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░   12 / 50               │
│  ─────────────────────────────────────────────────                  │
│                                                                     │
│                                                                     │
│                                                                     │
│                          木漏れ日                                   │
│                                                                     │
│                                                                     │
│                                                                     │
│                  ─────────────────────────────────                  │
│                  Press Space or tap to reveal answer                │
│                  ─────────────────────────────────                  │
│                                                                     │
│                    [     Show Answer     ]                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Back of card (answer revealed):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Core N3 Vocab]                         [Comprehension]   ✕ End      │
│                                                                     │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░   12 / 50               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                       木漏れ日                                 │  │
│  │                こもれび — komorebi                             │  │
│  │                                                               │  │
│  │  Sunlight filtering through leaves                            │  │
│  │  [noun] · N/A · Beyond JLPT · neutral                        │  │
│  │                                                               │  │
│  │  ─────────────────────────────────────────────────────────   │  │
│  │  木漏れ日が差し込む静かな午後。                                │  │
│  │  A quiet afternoon with sunlight streaming through the trees. │  │
│  │                                                               │  │
│  │  [▸ Kanji Breakdown]  [▸ Mnemonic]  [▸ Similar Cards]        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────┬──────────┬──────────┬──────────┐                     │
│  │  Again   │   Hard   │   Good   │   Easy   │                     │
│  │   (1)    │   (2)    │  (3) 3d  │  (4) 9d  │                     │
│  └──────────┴──────────┴──────────┴──────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Deck List

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  ── My Decks ──────────────────────────────     │
│                   │                                                 │
│                   │  [🔍 Search decks...]    [+ New Deck]           │
│                   │                                                 │
│                   │  ┌─────────────────────────────────────────┐   │
│                   │  │ 📚 Core N3 Vocabulary          [···]    │   │
│                   │  │ 320 cards · 12 due · Comprehension       │   │
│                   │  │ ████████████████░░░░░  68% learned      │   │
│                   │  └─────────────────────────────────────────┘   │
│                   │                                                 │
│                   │  ┌─────────────────────────────────────────┐   │
│                   │  │ 📝 JLPT N2 Grammar                [···] │   │
│                   │  │ 89 patterns · 5 due · Grammar           │   │
│                   │  │ ████████░░░░░░░░░░░░  32% learned       │   │
│                   │  └─────────────────────────────────────────┘   │
│                   │                                                 │
│                   │  ── Subscribed Premade Decks ──                 │
│                   │                                                 │
│                   │  ┌─────────────────────────────────────────┐   │
│                   │  │ 🎌 JLPT N5 Vocabulary   [Premade] [···] │   │
│                   │  │ 800 cards · 0 due · All caught up ✓     │   │
│                   │  └─────────────────────────────────────────┘   │
│                   │                                                 │
│                   │  [+ Browse Premade Decks]                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Deck Detail

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  ← Decks    Core N3 Vocabulary        [···]    │
│                   │                                                 │
│                   │  ┌─────────────┐  320 cards  |  12 due today   │
│                   │  │  N3  Vocab  │  68% learned · 127 reviews    │
│                   │  └─────────────┘  Created 3 months ago         │
│                   │                                [▶ Start Review] │
│                   │  ─────────────────────────────────────────────  │
│                   │  [All] [New] [Learning] [Review] [Suspended]    │
│                   │                                                 │
│                   │  [🔍 Search cards...]          [+ Add Card]     │
│                   │                                                 │
│                   │  ┌──────────────────────────────────────────┐  │
│                   │  │ 食べる        たべる                     │  │
│                   │  │ to eat · V1 · N5 · neutral  [Review]     │  │
│                   │  └──────────────────────────────────────────┘  │
│                   │  ┌──────────────────────────────────────────┐  │
│                   │  │ 雰囲気        ふんいき                   │  │
│                   │  │ atmosphere · N · N2 · neutral  [New]     │  │
│                   │  └──────────────────────────────────────────┘  │
│                   │  ┌──────────────────────────────────────────┐  │
│                   │  │ 木漏れ日      こもれび                   │  │
│                   │  │ sunlight filtering · N · Beyond JLPT     │  │
│                   │  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Card Detail / Edit

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  ← Core N3 Vocab    木漏れ日         [Edit]    │
│                   │                                                 │
│                   │  ┌──────────────────────────────────────────┐  │
│                   │  │                木漏れ日                  │  │
│                   │  │  こもれび   komorebi                     │  │
│                   │  │                                          │  │
│                   │  │  Sunlight filtering through leaves       │  │
│                   │  │  [noun] · Beyond JLPT · neutral          │  │
│                   │  └──────────────────────────────────────────┘  │
│                   │                                                 │
│                   │  ── Example Sentences ──                        │
│                   │  木漏れ日が差し込む静かな午後。                │
│                   │  A quiet afternoon with sunlight...             │
│                   │  [Regenerate →]                                 │
│                   │                                                 │
│                   │  ── Kanji Breakdown ──                          │
│                   │  木 (tree) · 漏 (leak) · 日 (sun/day)           │
│                   │                                                 │
│                   │  ── Mnemonic ──                                 │
│                   │  "Tree (木) + leak (漏) + sun (日)..."           │
│                   │  [Regenerate →]                                 │
│                   │                                                 │
│                   │  ── Review History ──                           │
│                   │  ┌─────────────────────────────────────────┐   │
│                   │  │ [Sparkline chart: last 10 reviews]       │   │
│                   │  │ Stability: 4.7d · Difficulty: 5.1        │   │
│                   │  │ Next review: Apr 27                      │   │
│                   │  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.6 Add Card (AI-Assisted)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  ← Core N3 Vocab    Add New Card                │
│                   │                                                 │
│                   │  ┌──────────────────────────────────────────┐  │
│                   │  │  Enter a Japanese word or sentence:      │  │
│                   │  │  ┌────────────────────────────────────┐  │  │
│                   │  │  │  木漏れ日                       ✕  │  │  │
│                   │  │  └────────────────────────────────────┘  │  │
│                   │  │                    [✨ Generate with AI]  │  │
│                   │  └──────────────────────────────────────────┘  │
│                   │                                                 │
│                   │  ── Generated Card Preview ──  [Loading...]     │
│                   │                                                 │
│                   │  ┌──────────────────────────────────────────┐  │
│                   │  │  Word:    木漏れ日                       │  │
│                   │  │  Reading: こもれび                       │  │
│                   │  │  Meaning: Sunlight filtering through...  │  │
│                   │  │  Level:   Beyond JLPT                    │  │
│                   │  │                                          │  │
│                   │  │  Sentences: [1 of 3 ▸]                  │  │
│                   │  │  木漏れ日が差し込む静かな午後。          │  │
│                   │  │                                          │  │
│                   │  │  Mnemonic: [expand ▸]                    │  │
│                   │  └──────────────────────────────────────────┘  │
│                   │                                                 │
│                   │     [Edit before adding]   [Add to Deck →]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.7 Analytics Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  Analytics   [Overview] [Forecast] [JLPT Gap]  │
│                   │                                                 │
│                   │  ┌───────────────────────────────────────────┐ │
│                   │  │           RETENTION HEATMAP               │ │
│                   │  │  Jan ░░░░░░░████████░░░░░██████░░░░░░     │ │
│                   │  │  Feb ████░░░░░░░░███████████░░░░████      │ │
│                   │  │  Mar ████████████████████████████████     │ │
│                   │  │  Apr ████████████████░                    │ │
│                   │  │  [legend: ░ missed  █ 85%+  ▓ <85%]      │ │
│                   │  └───────────────────────────────────────────┘ │
│                   │                                                 │
│                   │  ┌────────────────┐  ┌────────────────────┐   │
│                   │  │ ACCURACY       │  │ CARD TYPE BREAKDOWN│   │
│                   │  │ by card type   │  │                    │   │
│                   │  │                │  │ Comprehension  91%   │
│                   │  │ [Bar chart]    │  │ Production     76%   │
│                   │  │                │  │ Listening      79%   │
│                   │  └────────────────┘  └────────────────────┘   │
│                   │                                                 │
│                   │  ── Leech Watch ──                              │
│                   │  ⚠ 3 leeches detected                          │
│                   │  [見る · 見える · 見せる — show me →]          │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.8 Premade Deck Browser

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  Browse Premade Decks                           │
│                   │                                                 │
│                   │  [🔍 Search decks...]                           │
│                   │  [All] [Comprehension] [Grammar] [Kanji] [Domain]  │
│                   │                                                 │
│                   │  ── JLPT Vocabulary ──                          │
│                   │  ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│                   │  │ [N5]      │ │ [N4]      │ │ [N3]      │    │
│                   │  │ Core Vocab│ │ Core Vocab│ │ Core Vocab│    │
│                   │  │ ~800 cards│ │ ~1500     │ │ ~3750     │    │
│                   │  │[Subscribe]│ │[Subscribe]│ │ Added ✓   │    │
│                   │  └───────────┘ └───────────┘ └───────────┘    │
│                   │  ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│                   │  │ [N2]      │ │ [N1]      │ │[Beyond    │    │
│                   │  │ Core Vocab│ │ Core Vocab│ │ JLPT]     │    │
│                   │  │ ~6000     │ │ ~10000    │ │ ~2000     │    │
│                   │  │[Subscribe]│ │[Subscribe]│ │[Subscribe]│    │
│                   │  └───────────┘ └───────────┘ └───────────┘    │
│                   │                                                 │
│                   │  ── Domain Decks ──                             │
│                   │  ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│                   │  │ Business  │ │Anime &    │ │  Travel   │    │
│                   │  │ Japanese  │ │ Manga     │ │  Japanese │    │
│                   │  │ ~500      │ │ ~800      │ │ ~300      │    │
│                   │  │[Subscribe]│ │[Subscribe]│ │[Subscribe]│    │
│                   │  └───────────┘ └───────────┘ └───────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.9 Onboarding — Level Selection (Step 1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              ○ ● ○ ○ ○   Step 1 of 5             [Skip →]          │
│                                                                     │
│                                                                     │
│                   What's your current Japanese level?               │
│                   We'll suggest the right starting decks.           │
│                                                                     │
│            ┌─────────────────────┐  ┌─────────────────────┐        │
│            │  🌱 Complete        │  │  📘 JLPT N5         │        │
│            │     Beginner        │  │     Hiragana/        │        │
│            │  Starting from zero │  │     basic vocab      │        │
│            └─────────────────────┘  └─────────────────────┘        │
│                                                                     │
│            ┌─────────────────────┐  ┌─────────────────────┐        │
│            │  📗 JLPT N4         │  │  📙 JLPT N3         │        │
│            │   ~1 year of study  │  │   Intermediate       │        │
│            └─────────────────────┘  └─────────────────────┘        │
│                                                                     │
│            ┌─────────────────────┐  ┌─────────────────────┐        │
│            │  📕 JLPT N2         │  │  📔 N1 or Beyond    │        │
│            │   Upper-intermediate│  │   Advanced learner   │        │
│            └─────────────────────┘  └─────────────────────┘        │
│                                                                     │
│                                                                     │
│                              [Continue →]                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.10 Session Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        ✓ Session Complete                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  50 cards reviewed · 38 min · 88% correct                   │   │
│  │                                                             │   │
│  │  ████  Again: 6    ████  Hard: 4    ████  Good: 32          │   │
│  │  ░░░░              ░░░░             ████  Easy: 8           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ── Personal Bests ──                                               │
│  🏆 Longest session this week!                                      │
│                                                                     │
│  ── Cards to Watch ──                                               │
│  ⚠ 2 potential leeches detected: [見る] [気になる]                 │
│  [Review these first next time]                                     │
│                                                                     │
│  ── Next Review ──                                                  │
│  12 cards due in 3 hours · 28 cards due tomorrow                    │
│                                                                     │
│  [Review Again]                [Back to Dashboard →]                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component Spatial Map

How the major components relate spatially on key surfaces.

### 5.1 App Shell (Desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│  <RootLayout>                                                        │
│  ┌────────────┐  ┌──────────────────────────────────────────────┐   │
│  │ <Sidebar>  │  │  <MainContent>                               │   │
│  │            │  │  ┌──────────────────────────────────────┐   │   │
│  │ <NavLogo>  │  │  │  <TopBar> (page-specific)            │   │   │
│  │ <NavItems> │  │  └──────────────────────────────────────┘   │   │
│  │ <Progress> │  │                                              │   │
│  │   Widget   │  │  ┌──────────────────────────────────────┐   │   │
│  │            │  │  │  {children} — page content           │   │   │
│  │ <Settings> │  │  │                                      │   │   │
│  │ <UserMenu> │  │  │                                      │   │   │
│  └────────────┘  │  └──────────────────────────────────────┘   │   │
│                  └──────────────────────────────────────────────┘   │
│  <ToastContainer> (portal, bottom-center)                           │
│                                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Review Session

```
┌──────────────────────────────────────────────────────────────────────┐
│  <ReviewSessionLayout> (full-bleed, no sidebar)                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  <SessionHeader> — deck name, card type, end button          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  <SessionProgress> — progress bar + count                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  <ReviewCard>                                                │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  <CardFront> or <CardBack>   (conditional)             │ │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │ │   │
│  │  │  │  <FuriganaText>           (word display)         │  │ │   │
│  │  │  └──────────────────────────────────────────────────┘  │ │   │
│  │  │  <MeaningBlock>             (back only)                 │ │   │
│  │  │  <ExampleSentence>          (back only)                 │ │   │
│  │  │  <ExpandableSection>        (kanji/mnemonic/similar)    │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  <ShowAnswerButton>  or  <RatingButtons>   (conditional)     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. User Flows

### 6.1 New User First Session Flow

```
Landing (/) 
  → Sign Up (/signup)
    [Enter email + display name + password → Submit → POST /api/v1/auth/signup]
    → OTP Verification (VerifyView inline at /signup — URL does not change)
      [Enter 6-digit code from email — same device, no link to click]
      → Onboarding Step 1: Level (/onboarding/level) 
        → Step 2: Goal (/onboarding/goal) 
          → Step 3: Interests (/onboarding/interests) 
            → Step 4: Schedule (/onboarding/schedule) 
              → Step 5: Recommended Decks (/onboarding/decks) 
                [Add Recommended Decks]
                → Dashboard (/dashboard)
                  [Start Review button visible with due count]
                  → Review Session (/review/session)
                    → Session Summary (/review/summary)
                      → Dashboard
```

### 6.2 Returning User Daily Review Flow

```
Dashboard
  [42 due · Start Review →]
  → Review Session
    [Rate cards until queue empty]
    → Session Summary
      [Back to Dashboard]
      → Dashboard
        [0 due · Next review in 3 hours]
```

### 6.3 Add Card with AI Flow

```
Deck Detail (/app/decks/[id])
  [+ Add Card]
  → Add Card Page (/app/decks/[id]/cards/new)
    [Enter word: 木漏れ日]
    [✨ Generate with AI]
    → AI generates card (streaming preview appears)
      [Review generated content]
      [Add to Deck →]
      → Deck Detail
        [New card appears in list with "New" badge]
```

### 6.4 Subscribe to Premade Deck Flow

```
Deck List (/app/decks)
  [+ Browse Premade Decks]
  → Premade Browser (/app/decks/browse)
    [Subscribe to "JLPT N2 Vocabulary"]
    → Confirmation dialog: "Add 6,000 cards to your queue? 
       20 new cards/day at your current setting."
      [Confirm]
      → Deck List
        [N2 deck now appears under "Subscribed Premade Decks"]
        [Due count on dashboard updates]
```

### 6.5 Leech Investigation Flow

```
Dashboard or Analytics
  [⚠ 3 leeches detected]
  → Analytics Overview
    [Click leech: 見る]
    → Card Detail (/app/decks/[id]/cards/[cardId])
      [AI Diagnosis: "Confused with 見える and 見せる"]
      [AI Prescription: "Review all three together"]
      [View Similar Cards →]
      → Similar cards panel slides in
        [Start targeted drill session]
```

---

## 7. Data Display Patterns

### 7.1 Card in List View

All card list items follow this consistent layout:

```
┌──────────────────────────────────────────────────────────────────┐
│  [word — 24px bold]     [reading — 13px secondary]   [status]   │
│  [meaning — 15px]                             [JLPT badge] [···]│
└──────────────────────────────────────────────────────────────────┘
```

- Status badge: colored dot — grey (new), amber (learning), green (review), red (relearning)
- `[···]` opens a context menu: Edit / Suspend / Delete / View Similar
- Clicking the row navigates to the card detail page

### 7.2 FSRS Stats Display

Raw FSRS numbers are always accompanied by human-readable context:

| Raw Value | Displayed As |
|---|---|
| `stability: 4.72` | "Stability: ~5 days" |
| `difficulty: 5.1` | "Difficulty: 5.1 / 10" |
| `due: 2026-04-27` | "Next review: in 3 days (Apr 27)" |
| `state: 2` | "Status: In Review" |
| `lapses: 3` | "Lapses: 3 times" |

Never show raw state integers or ISO timestamps to the user anywhere in the UI.

### 7.3 Empty States per Page

| Page | Empty State | CTA |
|---|---|---|
| Deck List | "You haven't created any decks yet." | Browse Premade Decks |
| Card List | "This deck has no cards." | Add Card / Browse Premade |
| Dashboard (0 due) | "You're all caught up! Next review in 3h." | — |
| Analytics (no data) | "Complete a few review sessions to see your stats." | Start Review |
| Search (no results) | "No cards match '[query]'." | Clear Search |

---

*End of IA & Wireframe Guide v1.3.0*
