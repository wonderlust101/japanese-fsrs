# Product Requirements Document
## AI-Enhanced FSRS for Japanese

**Version:** 1.3.0  
**Status:** Active  
**Last Updated:** 2026-04-28

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Personas](#3-user-personas)
4. [Feature Breakdown](#4-feature-breakdown)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Out of Scope](#6-out-of-scope)
7. [Appendix: Future Roadmap](#7-appendix-future-roadmap)

---

## 1. Overview

### 1.1 Problem Statement

Existing spaced repetition tools (Anki, Bunpro, jpdb.io, Migaku) treat Japanese as a generic language. They fail to account for the unique layered complexity of Japanese — kanji, readings, pitch accent, register, and the deep interdependencies between vocabulary and grammar. Anki requires heavy manual setup; Bunpro covers grammar but not vocabulary depth; jpdb.io has no AI; Migaku requires complex external tooling. No single tool provides an intelligent, fully integrated Japanese acquisition experience.

### 1.2 Solution

An AI-native spaced repetition application built specifically for Japanese learners. The core engine is an implementation of the FSRS (Free Spaced Repetition Scheduler) algorithm tuned for Japanese-specific card types. AI augments every layer — card generation, weakness diagnosis, personalized mnemonics, and contextual sentence creation — in a single, self-contained application.

### 1.3 Target Audience

Japanese learners from beginner (N5) through advanced (post-N1), with particular emphasis on self-study learners who have tried and outgrown Anki's generic approach.

---

## 2. Goals & Success Metrics

### 2.1 Product Goals

- Provide the most intelligent and frictionless Japanese SRS experience available
- Reduce setup time compared to Anki from hours to minutes
- Surface actionable insights about a learner's weaknesses automatically
- Cover vocabulary, kanji, grammar, and listening in a single unified platform

### 2.2 Success Metrics

| Metric | Target |
|---|---|
| Day-7 retention rate | ≥ 65% of new users still active |
| Day-30 retention rate | ≥ 40% of new users still active |
| Average daily review completion rate | ≥ 80% of scheduled reviews completed |
| Card retention accuracy (target) | ≥ 85% at user-configured retention target |
| AI-generated card acceptance rate | ≥ 75% of AI-generated cards accepted without edit |
| Time-to-first-review after signup | ≤ 5 minutes |

---

## 3. User Personas

### 3.1 The Frustrated Anki User — *"Kenji"*
- Has been using Anki for 1–2 years
- Has thousands of cards but no structured weakness analysis
- Tired of manual card creation and plugin management
- Wants intelligence built in, not bolted on

### 3.2 The JLPT Candidate — *"Sofia"*
- Targeting N3 or N2 within 6–12 months
- Needs structured alignment to JLPT vocabulary and grammar lists
- Motivated by clear progress milestones and gap analysis

### 3.3 The Immersion Learner — *"Marcus"*
- Watches anime and reads manga as primary study method
- Wants to mine vocabulary from real content efficiently
- Values example sentences from actual media over textbook Japanese

### 3.4 The Absolute Beginner — *"Yuki"*
- Just started learning Japanese
- Overwhelmed by the number of tools and approaches available
- Needs guidance, sensible defaults, and a clear learning path without configuration

---

## 4. Feature Breakdown

> **Priority Legend**
> - 🟢 **P0** — Core, must ship at launch
> - 🟡 **P1** — Important, target for v1.1
> - 🔴 **P2 (Non-Priority)** — Valuable but deferred; included for roadmap completeness

---

### 4.1 Core SRS Engine

| ID | Feature | Priority |
|---|---|---|
| SRS-01 | FSRS algorithm implementation with Japanese-specific scheduling parameters | 🟢 P0 |
| SRS-02 | Separate scheduling tracks for comprehension (Japanese → concept), production (concept → Japanese), and listening (audio → concept) | 🟢 P0 |
| SRS-03 | Linked card types — each vocabulary item spawns multiple card types that share performance data | 🟢 P0 |
| SRS-04 | Leech detection with AI-powered diagnosis and prescription | 🟢 P0 |
| SRS-05 | Forgetting curve visualization per card and per deck | 🟡 P1 |
| SRS-06 | Customizable retention target with FSRS global interval adjustment | 🟢 P0 |
| SRS-07 | Vacation / catch-up mode that distributes overdue review backlog intelligently | 🟡 P1 |
| SRS-08 | Daily new card limits, review caps, and time-boxing configuration | 🟢 P0 |

---

### 4.2 Card & Deck Intelligence

| ID | Feature | Priority |
|---|---|---|
| CARD-01 | Automatic card generation from a single word or sentence input using AI | 🟢 P0 |
| CARD-02 | Kanji decomposition layer — radicals, stroke order, related kanji surfaced per card | 🟢 P0 |
| CARD-03 | Kunyomi / onyomi disambiguation with context-aware reading guidance | 🟢 P0 |
| CARD-04 | Pitch accent integration with visual diagram and audio on every card | 🟡 P1 |
| CARD-05 | Nuance & register tagging — casual, formal, written-only, archaic, slang, gendered | 🟢 P0 |
| CARD-06 | Homophone grouping and disambiguation (e.g. 箸/橋/端) | 🟡 P1 |
| CARD-07 | Part of speech, vocabulary level, and frequency rank metadata on every card — level uses a 6-tier system: N5, N4, N3, N2, N1, and **Beyond JLPT** (for native-level, domain-specific, or literary vocabulary not covered by the JLPT standard) | 🟢 P0 |
| CARD-08 | Common collocations surfaced per vocabulary card | 🟡 P1 |

---

### 4.3 AI Learning Features

| ID | Feature | Priority |
|---|---|---|
| AI-01 | Contextual sentence generation tuned to the user's current grammar level and interests | 🟢 P0 |
| AI-02 | Personalized mnemonic generation based on native language and known vocabulary | 🟢 P0 |
| AI-05 | AI explanation on card failure — contextual breakdown on demand | 🟡 v1.4 |

---

### 4.4 Immersion & Mining

| ID | Feature | Priority | Notes |
|---|---|---|---|
| IMM-01 | Browser extension for sentence mining — highlight a word on any Japanese webpage to add it to your deck with surrounding sentence preserved | 🔴 **P2 — Non-Priority** | Deferred; adds significant cross-platform complexity |
| IMM-02 | Subtitle mining — import SRT files and extract vocabulary with original subtitle line as card context | 🔴 **P2 — Non-Priority** | Deferred; useful but not core to initial experience |
| IMM-03 | Frequency-aware imports — cards tagged with frequency rank when mining from any source | 🔴 **P2 — Non-Priority** | Deferred; frequency metadata can be added later |
| IMM-04 | Reading mode — paste Japanese text for in-app reading with instant lookups feeding directly into SRS queue | 🔴 **P2 — Non-Priority** | Deferred; scope is significant and competitors cover this |
| IMM-05 | Immersion time tracker — log reading and listening time alongside SRS reviews | 🔴 **P2 — Non-Priority** | Deferred; valuable for dashboard but not core SRS value |
| IMM-06 | i+1 filtering — scan content and identify exactly which words to learn for comprehension | 🟡 P1 | Lighter version can ship without full reading mode |

---

### 4.5 Grammar Layout & Bridging

| ID | Feature | Priority |
|---|---|---|
| GRAM-01 | Dedicated grammar SRS support covering N5–N1 and beyond using the Grammar layout | 🟢 P0 |
| GRAM-02 | Grammar cards include 5+ varied AI-generated example sentences per pattern | 🟢 P0 |
| GRAM-03 | Grammar → Vocabulary bridging — learning a grammar point surfaces related vocabulary | 🟡 P1 |
| GRAM-04 | Conjugation driller — dedicated mode for verb and adjective conjugation forms | 🟡 P1 |

---

### 4.6 Premade Decks

Premade decks solve the cold-start problem for new users. Instead of arriving at a blank app, users can immediately start reviewing high-quality, curated content.

| ID | Feature | Priority |
|---|---|---|
| PRE-01 | Curated vocabulary decks for each JLPT level (N5 through N1) pre-loaded and available at signup | 🟢 P0 |
| PRE-02 | Curated "Beyond JLPT" deck covering common native-level vocabulary not on any JLPT list | 🟢 P0 |
| PRE-03 | Domain-specific premade decks — Business Japanese, Anime & Manga, Food & Cooking, Travel, Medical, Tech | 🟡 P1 |
| PRE-04 | Premade grammar decks aligned to each JLPT level with AI-generated example sentences | 🟢 P0 |
| PRE-05 | Premade kanji decks by Joyo grade level (Grade 1 through Grade 6 + Secondary) | 🟡 P1 |
| PRE-06 | Onboarding deck picker — after signup, users select their current level and goals, and the app auto-subscribes them to the appropriate premade decks | 🟢 P0 |
| PRE-07 | Premade deck "fork" — users can clone a premade deck into their personal library and customize cards without affecting the source deck | 🟡 P1 |
| PRE-08 | Deck progress overlay — when studying a premade deck, show % completion against the full deck regardless of how many cards have been added to the user's queue | 🟢 P0 |
| PRE-09 | Premade deck versioning — when the curated content is updated (corrections, new sentences), users are notified and can merge updates without losing their FSRS progress | 🟡 P1 |

**Premade Deck Catalogue at Launch (P0):**

| Deck Name | Card Count (approx.) | Type |
|---|---|---|
| JLPT N5 Vocabulary | ~800 | Vocabulary |
| JLPT N4 Vocabulary | ~1,500 | Vocabulary |
| JLPT N3 Vocabulary | ~3,750 | Vocabulary |
| JLPT N2 Vocabulary | ~6,000 | Vocabulary |
| JLPT N1 Vocabulary | ~10,000 | Vocabulary |
| Beyond JLPT Core | ~2,000 | Vocabulary |
| JLPT N5–N1 Grammar | ~300 patterns | Grammar |
| Joyo Kanji Grade 1–6 | ~1,006 kanji | Kanji |

---

### 4.7 Audio & Listening

| ID | Feature | Priority | Notes |
|---|---|---|---|
| AUD-01 | Native audio on every card — human samples where available, TTS fallback | 🟢 P0 | |
| AUD-02 | Listening-first card mode — audio presented before text | 🟢 P0 | |
| AUD-03 | Audio-only review sessions — no text, pure listening comprehension | 🟡 P1 | |
| AUD-04 | Shadowing mode — record pronunciation and receive AI pitch accent and phoneme feedback | 🔴 **P2 — Non-Priority** | Deferred; requires audio ML pipeline and careful UX |

---

### 4.8 Personalization & Profiles

| ID | Feature | Priority |
|---|---|---|
| PERS-01 | JLPT level alignment with gap analysis for target level | 🟢 P0 |
| PERS-02 | Custom study goals (e.g. pass N2, read manga, watch without subtitles) | 🟢 P0 |
| PERS-03 | Interests profile used to flavor AI-generated sentences | 🟢 P0 |
| PERS-05 | **User Profile Management** (CRUD for user goals, level, and interest profiles) | 🟢 P0 |

---

### 4.9 Progress & Analytics

| ID | Feature | Priority |
|---|---|---|
| ANAL-01 | Retention heatmap — calendar view of daily retention rates | 🟢 P0 |
| ANAL-02 | Kanji coverage map — visual display across the Joyo set organized by grade and frequency | 🟡 P1 |
| ANAL-03 | Vocabulary coverage by domain — % of a given manga, novel, or show you'd understand today | 🟡 P1 |
| ANAL-04 | Level progression tracker — JLPT-aligned milestones with projected dates | 🟢 P0 |
| ANAL-05 | Review accuracy broken down by cognitive track (comprehension vs. production vs. listening) | 🟢 P0 |
| ANAL-06 | Streak and review history calendar | 🟢 P0 |

---

### 4.10 Social & Community

> All features in this section are **🔴 P2 — Non-Priority** and deferred to a future release. They are documented here for roadmap awareness.

| ID | Feature | Notes |
|---|---|---|
| SOC-01 | Shared deck marketplace with quality ratings | Deferred — moderation complexity |
| SOC-02 | Community mnemonic voting — users submit and upvote mnemonics per card | Deferred — requires user-generated content infrastructure |
| SOC-03 | Study group streaks and shared accountability | Deferred — social features require critical mass |
| SOC-04 | Content-linked public decks for specific manga, novels, or shows | Deferred — licensing and maintenance concerns |

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Review session load time: ≤ 500ms for first card
- AI card generation: ≤ 3 seconds per card
- API response time (p95): ≤ 200ms for non-AI endpoints
- Offline review capability: users should be able to complete reviews without internet, syncing on reconnect

### 5.2 Reliability
- Uptime target: 99.9% monthly
- Review data must never be lost — all review results persisted before UI advances
- FSRS scheduling state must be consistent across devices

### 5.3 Security
- All user data encrypted at rest and in transit
- JWT-based session management via Supabase Auth; every API request verifies the token server-side — tokens are never trusted without server-side validation
- Account verification at signup uses a **6-digit OTP sent to the user's email**, entered on the same device and browser where signup was initiated — this prevents the "device breakage" pattern inherent in magic link flows, where opening the link on a different device leaves the user without a session on the device they signed up from
- Sessions are scoped per-device; logout invalidates only the current device session and does not sign the user out elsewhere
- No user review data is shared with third parties or used for AI training without explicit opt-in

### 5.4 Accessibility
- WCAG 2.1 AA compliance
- Full keyboard navigation for review sessions
- Screen reader support for card content and UI chrome

### 5.5 Internationalization
- UI language: English at launch
- All Japanese text rendered correctly across platforms (CJK font fallback stacks)
- Furigana rendering support throughout the app

---

## 6. Out of Scope

The following are explicitly out of scope and will not be considered for any near-term release:

- Native mobile applications (iOS / Android) — web-first only at launch
- Chinese or Korean SRS support
- Video content integration or video player
- Paid tutoring or human review features
- Automated JLPT test simulation
- Integration with physical flashcard printing

---

*End of PRD v1.3.0*

---

## 7. Appendix: Future Roadmap

Features listed here are deferred to v1.4 or beyond to ensure a focused MVP delivery.

| ID | Feature | Status |
|---|---|---|
| AI-03 | Confusion pair detection and proactive drilling | Deferred (v1.4) |
| AI-04 | Weak point pattern analysis with macro insights | Deferred (v1.4) |
| AI-06 | Grammar point linking (Vocabulary → Grammar) | Deferred (v1.4) |
| AI-07 | Semantic similarity search (pgvector) | Deferred (v1.4) |
| PERS-04 | Vocabulary domain tracking (visual radar) | Deferred (v1.4) |
| IMM-01 | Browser extension for sentence mining | Deferred (P2) |
| IMM-02 | Subtitle mining (.srt extraction) | Deferred (P2) |
| AUD-03 | Audio-only review sessions | Deferred (v1.4) |
| SOC-01 | Shared deck marketplace | Deferred (P2) |
| SOC-02 | Community mnemonic voting | Deferred (P2) |
| SOC-03 | Study group streaks | Deferred (P2) |
| SOC-04 | Content-linked public decks | Deferred (P2) |
