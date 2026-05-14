/**
 * Single source of truth for the Settings sections.
 *
 * The horizontal tab bar reads this list, so adding a section (or
 * reordering) updates the nav in one move. The ids are also the route
 * segments under /settings: clicking a tab navigates to /settings/<id>,
 * and each leaf page renders the matching section into the shared
 * settings layout outlet.
 *
 * Each section carries a distinct identity kanji. The three were chosen
 * to NOT collide with the sidebar's section kanji (練 Practice, 書 Library,
 * 析 Insights) so a learner glancing between the sidebar and the settings
 * tab bar never sees the same kanji standing for two different things.
 *
 *   人 (hito)   "person"        — Profile  (includes sign-in email)
 *   学 (manabu) "learn / study" — Learning
 *   鍵 (kagi)   "key / lock"    — Security
 *
 * Account was folded into Profile until email-change and billing land
 * (a tab with a single read-only row didn't earn its slot). The 帳
 * ledger kanji is reserved for that future restoration.
 */

export interface SettingsSection {
  readonly id:    string
  readonly kanji: string
  readonly label: string
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'profile',  kanji: '人', label: 'Profile'  },
  { id: 'learning', kanji: '学', label: 'Learning' },
  { id: 'security', kanji: '鍵', label: 'Security' },
] as const
