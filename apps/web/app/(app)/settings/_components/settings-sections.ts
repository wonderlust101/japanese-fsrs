/**
 * Single source of truth for the Settings sections.
 *
 * The settings tab bar reads from this list. Adding or reordering here
 * updates the bar. The `id` is also the URL segment under /settings —
 * clicking a tab navigates to `/settings/<id>`, and each leaf page mounts
 * the matching section into the shared layout outlet.
 *
 * Each section carries a distinct identity kanji. The set was chosen
 * to NOT collide with the sidebar's section kanji (練 Practice, 書 Library,
 * 析 Insights) so a learner glancing between sidebar and settings never
 * sees the same kanji standing for two different things.
 *
 *   人 (hito)    "person"       — Account
 *   学 (manabu)  "learn"        — Learning
 *   鍵 (kagi)    "key / lock"   — Security
 *
 * Three sections only, by deliberate MVP scope: every control on every
 * tab persists. Review behavior, Display, and Data & sync were removed
 * in the MVP cut — they each required either un-built backend (apkg
 * import/export, sync layer, offline asset cache) or un-committed brand
 * decisions (dark theme) that didn't earn their slot on the practice
 * surface. They will return when their backend or brand decisions land.
 */

export interface SettingsSection {
  readonly id:          string
  readonly kanji:       string
  readonly label:       string
  readonly description: string
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id:          'profile',
    kanji:       '人',
    label:       'Account',
    description: 'Your identity, locale, and goal.',
  },
  {
    id:          'learning',
    kanji:       '学',
    label:       'Learning',
    description: 'How firmly you practice.',
  },
  {
    id:          'security',
    kanji:       '鍵',
    label:       'Security',
    description: 'Sign-in and account removal.',
  },
] as const
