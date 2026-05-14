# Product

## Register

product

## Users

Self-directed Japanese learners working toward proficiency targets: primarily JLPT-aligned (N5 through N1), extending to "Beyond JLPT" for native-level, domain-specific, and literary vocabulary outside the JLPT canon.

The canonical user is an adult who has already chosen Japanese as a serious commitment. Many have used Anki, WaniKani, or Bunpro before. They expect competence from their tools but are tired of hostile UX.

The primary moment of use is a **morning ritual**: coffee, calm room, 15–30 focused minutes before the day starts. Mostly desktop or tablet, in good light. Reviews are a *chosen practice*, not a guilt-driven streak. Mobile is a secondary surface for stolen moments later in the day.

The job-to-be-done: *"Help me retain Japanese vocabulary, kanji, and grammar with the least friction and the most insight, without making me feel like I'm grinding."*

## Product Purpose

> **Tomo is your patient practice partner for Japanese: quiet daily reviews, intelligent scheduling, and a teacher's eye for your weak spots.**

Beyond the one-liner, Tomo is an AI-enhanced spaced-repetition app for Japanese learners: a Japanese-aware **FSRS v5** (Free Spaced Repetition Scheduler, the modern algorithm Anki users now opt into) implementation paired with GPT-class language intelligence to schedule reviews, generate cards, diagnose leeches, write personalized mnemonics, and produce contextual sentences, all in a single self-contained app.

Success looks like:
- A daily practice users *want* to return to, not one they feel guilty about skipping.
- Retention curves that genuinely outperform manually-tuned Anki for the same effort.
- AI features that feel like a knowledgeable teacher, not a bolted-on chatbot.
- A learner can move from N5 cold start to N2-comfortable without needing another tool for the SRS half of their study.

The non-purpose: Tomo is not a community platform, not a content-mining suite, not a gamified course. It is a **practice instrument**, closer to a beautiful zafu cushion than to a gym.

### Why not just use Anki?

The Japanese-learning genre is split across three categories of tool, and most learners end up jury-rigging across all of them.

- **Anki** has a modern algorithm (and now ships FSRS), but no AI and no warmth. The cards a learner makes are only as good as the time they have to make them well.
- **ChatGPT and the like** can write personalized sentences and explain grammar, but they do not schedule reviews, do not track retention, and do not know what a learner is working on.
- **Warm-companion apps** (Migaku, jpdb, MaruMori) split the difference but typically compromise on either algorithmic depth, AI quality, or design craft.

Tomo's promise is **integration**: a single tool that ships modern FSRS, AI-as-teacher, and considered design under one roof. The thesis is not "we have three features in a list." The thesis is that **switching context between three apps is friction, and that friction is the daily-practice-killer Tomo exists to remove.** A learner who uses Tomo never has to leave Tomo to study Japanese well.

## Business Model

For the MVP release, **Tomo is fully free**. Every feature ships available to every learner: FSRS scheduling, premade decks (JLPT N5 through N1, Beyond JLPT, Joyo Kanji, grammar patterns), manual card creation, AI-assisted card generation, AI-personalized contextual example sentences, AI-written mnemonics, leech diagnosis and prescriptive next-step guidance, full analytics, offline review, and full keyboard and screen-reader accessibility. No feature is gated.

A monetization model may return in a later phase once the product has shipped, reached learners, and demonstrated value. The MVP's job is to be the best Japanese SRS practice instrument it can be, not to defend a paywall. Decisions about future tiers, if any, will be made *after* learners are using the product, not before.

Two consequences worth pinning while the MVP is the active product:

- No code path checks an `entitlement` or `tier` flag. AI endpoints are gated only by authentication and by cost-control rate limits (per-minute and per-day quotas), which apply uniformly to every authenticated learner.
- Product copy, marketing surfaces, and onboarding say nothing about "Free" vs "Paid" or "Premium." Tomo is just Tomo.

## Brand Personality

Three words: **encouraging, considered, joyful.**

- **Encouraging**, not cheerleading. The app greets by name, acknowledges missed practice without shame, celebrates specific small wins. It assumes the learner is competent and committed, then makes them feel that way.
- **Considered**, not minimal-by-default. Every screen earns its restraint. Whitespace is intentional, type pairings are deliberate, chrome serves the Japanese content rather than competing with it. *Quiet* without *empty.*
- **Joyful**, not gamified. Small delights, a satisfying reveal animation, a progress bead that fills with care, a subtle ✦ when something goes well. Joy is structural; it is not a layer of confetti on top.

Sample voice (real copy, not aspirational):

- *"6 cards waiting, let's begin"* (never *"You have 6 reviews due."*)
- *"You skipped yesterday. No worries, right back at it."* (never *"You broke your streak!"*)
- *"Nice work on 食べる. You'll see this one Friday."* (never *"Correct! +10 XP."*)

### How AI shows up

Tomo's AI is **invisible**. Cards feel smart; sentences feel personal; leech diagnosis arrives as plain explanatory text. There is no "AI" chrome anywhere in the product: no sparkle icon, no "Generated by GPT" footer, no "AI mode" toggle, no *"AI-powered ✨"* taglines. The learner experiences a teacher who happens to know everything; they do not experience a chatbot.

This is deliberate, and it would remain deliberate even if a paid tier returned later. Most AI products fall into the trap of needing to brand "AI" everywhere — to justify a price, to perform sophistication, to look modern. Tomo refuses that trap. We trust learners to value sharper cards, sentences that fit their interests, and mnemonics that stick. We do not need a sparkle icon to prove the AI is doing its job.

The exception is **attribution and transparency**: a small, opt-in "how this was made" affordance is acceptable on long-form AI output (a generated sentence, a written mnemonic, a leech diagnosis) where a curious learner may legitimately want to peek behind the curtain. The default is closed; the affordance is quiet; the chrome stays out of the way.

### The brand mark

Tomo's visual identity is a **kitsune** (Japanese fox) curled in front of a deep red disc, with the kanji **友** ("tomo," friend) brushed in front. The whole mark is rendered in a single color, **Muted Berry Red `#B03646`**, closer to the vermillion of Inari shrines than to any tech-product red. The strokes are hand-brushed, not vector-geometric: the kanji has the cadence of calligraphy, the fox's tail has the weight of a sumi-e brush.

The choice is culturally precise. Foxes in Japanese folklore are messengers of **Inari**, the kami of rice, prosperity, and learning, symbols of cleverness and transformation. A kitsune embodying 友 reads as *your friend who helps you transform.* That meaning is the strategic anchor; the visual style (brushy, considered, ink-and-disc) is the consequence.

The color does heavy strategic work. `#B03646` is far enough from "tech indigo," "SaaS purple," "fintech navy," and "language-app green/orange" to side-step the obvious category reflexes. It is anchored in Japanese visual culture (Inari shrine vermillion), not in the AI-product-default lane. Color, mark, and meaning all align: kitsune-of-Inari, color-of-Inari, kanji-of-friendship.

Canonical brand assets live at `apps/web/public/brand/`:

- `logo.svg`: full mark for wordmark and large-format use.
- `favicon.svg`: same mark on a soft `#F7F7F7` rounded plate, for browser tabs and home-screen icons.
- `favicon.ico`: multi-resolution legacy fallback.
- `og.png`: 1200×630 share image for social and link unfurls.

## Anti-references

Tomo must explicitly NOT feel like:

- **Anki**: punishingly utilitarian. Flat blue defaults, raw HTML cards, the implicit pride of "serious learners only." Anki treats UX as an afterthought; Tomo treats it as core craft. The presence of joy is the difference.
- **Generic SaaS / AI-product-default**: indigo gradient hero, three-up feature cards, lucide-react icons everywhere, *"AI-powered ✨"* taglines, "Premium ✨ AI-Powered!" upgrade modals. The current `apps/web/app/globals.css` palette (indigo-500 primary, thin-stroke lucide icons, soft white cards on cool slate) IS the trap, and it is being explicitly **retired**, not merely avoided. The active visual work migrates the chrome out of indigo and into a palette anchored on the brand red.

What is *not* anti-referenced is also load-bearing. Tomo may borrow texture from:

- **Gentle gamification**: Duolingo-adjacent encouragement and progress rituals, but never guilt loops, never push-notification shame, never a talking mascot. Streaks are deferred to a later product version; the current product should not rely on streak pressure. The encouragement lives in the copy and in Tomo's silent presence on milestone moments, not in dialogue from a character.
- **Domain personality**: WaniKani-adjacent kanji-aware design touches, but never tribal pink-everywhere, never level-rank chrome.
- **Traditional Japanese visual culture**: sumi-e brush qualities, hi-no-maru disc compositions, kissaten warmth, Inari vermillion, the cadence of hand-calligraphy. Never tourist-shop Japan, never anime-cute, never ironic-orientalism. The cultural references must serve learners, not perform Japaneseness for an outside audience.

All three must serve the *encouraging, considered, joyful* voice and never break the warm-companion mood.

## Design Principles

1. **Two registers, one identity.** The product register is primary. Product surfaces and brand surfaces share the same voice, type system, and emotional temperature; a stranger should recognize the same Tomo across both.

2. **Joy is structural, not decorative.** The opposite of Anki. Warmth is not a polish-pass nice-to-have; it shows up in the cadence of motion, the choice of words, the framing of progress, the kindness of an empty-state. Remove the joy and Tomo loses its reason to exist.

3. **Refuse the AI-default; commit to ink and disc.** Indigo-gradient hero + glass cards + lucide-icon trio is the trap. The brand has formally committed away from it: the new primary is Muted Berry Red `#B03646`, the icon language must move toward something tactile (hand-drawn or sumi-adjacent, not stroke-1.5 utility), and chrome must read as ink-and-paper, not as 2024 SaaS. The current visual baseline is in the trap and is being deliberately migrated out.

4. **Cheer the human, respect the adult.** Encourage progress; never gamify, shame, or condescend. No "+10 XP." No streak-fear. No talking-mascot dialogue boxes. The user is a serious learner who chose Japanese, speak to that person.

5. **Morning calm; Japanese is the hero.** The default emotional register is bright/quiet/focused, a chosen ritual, not a guilt obligation. Density, color, and motion-energy decisions bias toward "calm desk at 7am" rather than "phone in bed at midnight" or "commute scramble." On every screen, the Japanese content (kanji, kana, sentences, furigana) is the most beautiful thing; chrome, controls, and metadata serve it.

6. **Tomo is presence, not personality.** The kitsune mark lives at identity positions (wordmark, favicon, auth screen, OG image, app icon) and surfaces as illustration on a small set of emotional moments: first card learned, major progress milestones, the daily review-summary screen, the 404 / empty-state pages, and later streak milestones if streaks return. Tomo *never* speaks in copy, *never* narrates progress, *never* appears in normal review chrome (chrome belongs to the Japanese, not the fox). The role is *to be there when it matters, not to perform.* The Duolingo distinction is structural: an owl that talks is a character; a kitsune that's quietly present is identity.

7. **Invisible AI, visible craft.** The intelligence is everywhere in the cards but nowhere in the chrome. Learners receive sharper cards, more personal sentences, and stickier mnemonics — not more visible "AI" branding. A surface that adds a sparkle icon, an "AI mode" toggle, or a "Generated by GPT" footer is wrong, whether or not those features are ever monetized. The justification is in what the AI *makes*, not what it is *labeled.*

## Accessibility & Inclusion

- **WCAG 2.1 AA** is the floor (per the PRD Accessibility requirement area). Strive for AAA on text contrast in long-form reading surfaces (sentences, mnemonics, grammar explanations).
- **Reduced motion** is honored end-to-end. The `prefers-reduced-motion` media query already disables animations in `globals.css`; that contract holds for all motion (opt-out only, never opt-in animation).
- **Color-blind safety** for the rating scale. Again/Hard/Good/Easy commonly map to red/orange/yellow/green and fail deuteranopia and protanopia; rating affordances communicate via position, label, *and* icon/texture, never color alone.
- **Full keyboard navigation** for review sessions (per the PRD Accessibility requirement area). Number keys 1–4 rate, space/enter reveals, escape pauses. The mouse is optional; the keyboard is canonical.
- **Screen-reader support** for card content. Japanese characters announce with appropriate `lang="ja"` attribution (already wired in CSS); furigana renders with `<ruby>`/`<rt>` for correct screen-reader pronunciation, never as decorative SVG.
- **CJK font fallbacks** stay configured (Noto Sans JP → Hiragino Sans → Yu Gothic). Never override with a Latin-only family on elements that may contain Japanese content.
- **Tomo's brand red against backgrounds.** When the kitsune mark is rendered on the neutral `#F9FAFB` page background, the `#B03646` to `#F9FAFB` contrast ratio is approximately 6.0:1, comfortably above the WCAG AA requirement for non-text content. The mark may be rendered against an off-white plate (`#F7F7F7`, as in the favicon) for additional headroom on saturated or photographic surfaces.
- **Universal access.** Accessibility is never a gateable feature. Every accessibility commitment in this section applies to every learner, full stop — reduced motion, keyboard navigation, screen-reader pronunciation, and color-blind safety are part of the product itself, not a configurable layer. This holds whether or not Tomo ever introduces a monetization model.
