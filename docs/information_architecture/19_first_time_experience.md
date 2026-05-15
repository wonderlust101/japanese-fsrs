# Page Spec: First-Time Experience

## Page Purpose

The first-time experience introduces Tomo's value before asking for commitment. The user should understand what Tomo does, feel a sample review, then create an account and complete onboarding.

The first-time experience should not start with a long questionnaire. A learner should see and feel the practice instrument before being asked to configure it.

## Recommended Order

1. Short product explanation.
2. Sample review.
3. Account creation.
4. Onboarding flow.
5. JLPT target selection.
6. Premade deck selection.
7. First Today state.

## Primary User Jobs

- Understand what Tomo is.
- Experience a sample review.
- Decide whether to create an account.
- Set learning direction.
- Choose starting material.
- Reach a ready-to-practice state.

## Content Hierarchy

### Product Explanation

Keep it short. Explain practice, card creation from context, and insight into weak spots.

### Sample Review

Let the user experience the core review interaction. This is more persuasive than a feature list.

### Account Creation

Ask after value has been demonstrated.

### Onboarding

Collect only information needed to set up the first useful experience.

## UX Notes

The biggest risk in onboarding is asking users to commit before they understand the product. Tomo should demonstrate its core loop quickly.

The sample review should be representative but short. It should not be a tutorial maze.

## UI Notes

- Keep the first screen focused and emotionally calm.
- Use Japanese content early, because Japanese should be the product hero.
- Avoid feature-card marketing patterns.
- Use clear progress through onboarding steps.
- Make skipped steps recoverable later in Settings.

## Onboarding Inputs

Recommended:

- JLPT target.
- Study goal.
- Premade deck selection.
- Daily new-card preference.
- Review reminder preference only if notifications are supported and optional.

Avoid asking too early:

- Detailed FSRS settings.
- Long interest taxonomy.
- Many card template choices.
- Source preferences.

## Interaction Notes

- Try sample review should not require account creation.
- Account creation should preserve onboarding progress.
- Premade deck selection should link to deck preview if users want more detail.
- After onboarding, bring users to Today with a clear first action.

## States

### Curious Visitor

Needs explanation and sample experience.

### Returning Visitor Without Account

Allow account creation and continuation.

### Account Created but Onboarding Incomplete

Resume onboarding.

### Onboarding Complete

Route to Today.

## Responsive Behavior

First-time experience should work well on mobile, but sample review should still be clear and usable. Avoid dense side-by-side onboarding layouts on small screens.

## Copy Tone

Encouraging, considered, and adult. Avoid hype, mascot chatter, and AI-feature marketing.

## Designer Watchouts

- Do not start with five questions before demonstrating value.
- Do not over-explain SRS before showing a card.
- Do not force premade deck selection without preview or skip.
- Do not make account creation feel like a wall before value.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
