# Page Spec: Settings

## Page Purpose

Settings controls product behavior, account details, learning preferences, review behavior, display choices, data, sync, and security. It should be structured around user intent, not implementation categories.

Settings should be clear enough for regular learners and complete enough for Anki-like users.

## Primary User Jobs

- Edit account information.
- Change learning target and preferences.
- Adjust review behavior.
- Configure display and Japanese reading preferences.
- Manage sync, import, export, and data.
- Update security settings.

## Recommended Sections

1. Account.
2. Learning.
3. Review Behavior.
4. Display.
5. Data and Sync.
6. Security.

## Section Guidance

### Account

- Name.
- Email.
- Account status.
- Subscription, if relevant.

### Learning

- JLPT target.
- Study goal.
- Daily new-card default.
- Retention target.
- Timezone.
- Interests.

### Review Behavior

- Show intervals on rating buttons.
- Keyboard shortcuts.
- Default setup behavior.
- New card behavior.
- Review order defaults.
- Bury related cards behavior.

### Display

- Theme.
- Japanese font size.
- Furigana display.
- Card density.
- Default Insights tab.

### Data and Sync

- Import.
- Export.
- Sync status.
- Offline data.
- Backups if supported.

### Security

- Password.
- Active sessions.
- Account deletion.

## UX Notes

The page should avoid duplicate Profile and Settings destinations. Profile-like identity information belongs inside Account or an account menu.

Use section-level organization so users can find settings by intent. Avoid one giant settings form.

## UI Notes

- Use clear section navigation.
- Group related settings visually.
- Explain high-impact settings before change.
- Confirm destructive or irreversible actions.
- Use inline descriptions for technical settings.
- Keep default settings visible but not noisy.

## Interaction Notes

- Changes that affect scheduling should clearly explain scope and timing.
- Review behavior changes should distinguish defaults from current session overrides.
- Display changes can apply immediately.
- Data export should show progress and completion.
- Account deletion should require strong confirmation.

## States

### Normal

Show sections with current values and edit controls.

### Unsaved Changes

Make unsaved state clear and recoverable.

### Sync Issue

Explain what is affected and what remains safe.

### Destructive Action

Use confirmation and clear consequence copy.

## Responsive Behavior

Desktop can use side navigation and content sections. Mobile should use a stacked settings list with clear section pages.

## Copy Tone

Practical and respectful. Avoid technical language unless necessary, and explain it when used.

## Designer Watchouts

- Do not recreate a separate Profile page that competes with Settings.
- Do not bury review behavior controls.
- Do not make destructive actions visually loud unless the user is actively confirming.
- Do not hide data and sync status.


## Designer Freedom

The designer should not treat this document as a rigid layout prescription. The goal is to preserve the page's information architecture, user intent, interaction priorities, and emotional tone while exploring the strongest visual composition. Components, spacing, and exact placement may change as long as the hierarchy and behavior remain clear.

## Accessibility Notes

- Maintain keyboard access for every interactive control.
- Use visible focus states for buttons, tabs, tables, filters, menus, and form fields.
- Do not communicate state by color alone.
- Ensure Japanese text is presented with appropriate language attribution in implementation.
- Keep body copy readable and avoid dense multi-column prose on narrow screens.
- Preserve screen-reader clarity for counts, status messages, error states, and dynamic updates.
