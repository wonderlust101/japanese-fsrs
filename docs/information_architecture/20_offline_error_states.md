# Page Spec: Offline and Error States

## Page Purpose

Offline and Error States define how Tomo communicates when network, sync, loading, or system problems occur. These states must protect user trust, especially during review.

The central emotional question is usually: “Is my progress safe?” The UI should answer that before giving technical details.

## Primary User Jobs

- Understand what happened.
- Know whether review progress is safe.
- Know whether they can continue.
- Know what action, if any, is required.
- Recover without losing context.

## State Principles

1. Reassure before explaining technical details.
2. Use learner-centered language, not system queue language.
3. Preserve current task when possible.
4. Make recovery actions clear.
5. Do not blame the user.

## Offline Review

If review can continue offline, say so directly.

Preferred copy direction:

“You’re offline. You can keep reviewing. Progress will sync when connection returns.”

Avoid:

“Sync queue pending.”

The second phrase may be accurate, but it does not answer the learner's emotional concern.

## Sync Pending

Show local save status and last sync when useful.

Recommended information:

- Saved locally.
- Number of pending changes, only if helpful.
- Last synced time.
- What will happen automatically.

## Error During Review

Review errors are high-trust moments. Make clear whether the current answer was saved.

Recommended content:

- What failed.
- Whether the current review progress is safe.
- Try again action.
- Continue offline if possible.
- Show technical details behind disclosure.

## Error Loading Today

Today errors should not look catastrophic if saved data is safe. Offer retry and safe navigation.

## Error Creating Card

If generated card creation fails, preserve the user's input. Never make the user retype Japanese and sentence context after a recoverable failure.

## Error Saving Card

Explain whether the card was saved, saved as draft, or not saved. Offer retry and draft recovery.

## UX Notes

The worst error state is ambiguous safety. If the user does not know whether review progress or card creation was saved, trust drops quickly.

## UI Notes

- Use inline state messages when possible.
- Use blocking dialogs only when the user cannot safely continue.
- Keep technical details hidden by default.
- Provide a clear primary recovery action.
- Avoid red-heavy visuals unless data loss or destructive action is involved.

## Recommended Error Message Structure

1. Human-readable title.
2. Safety statement.
3. Next action.
4. Optional details.

Example:

“Connection dropped. Your progress is saved locally. Keep reviewing or try syncing again.”

## States

### Offline but Usable

Allow continued review or browsing of locally available data.

### Offline and Not Enough Local Data

Explain what is unavailable and what remains accessible.

### Sync Pending

Show calm status and automatic next step.

### Recoverable Error

Offer retry and preserve user input.

### Blocking Error

Explain the block and recovery path.

### Data Conflict

Explain conflict in plain language and offer safe resolution.

## Responsive Behavior

Mobile offline states are especially important because commute use is likely. Keep messages short and actions large enough to tap.

## Copy Tone

Calm, precise, reassuring. Avoid alarm unless the user must take immediate action.

## Designer Watchouts

- Do not use technical queue language as the main message.
- Do not hide whether data is safe.
- Do not clear user input after errors.
- Do not use generic “Something went wrong” alone.
- Do not overuse destructive or red styling.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
