import { redirect } from 'next/navigation'

/**
 * /settings is no longer a single rendered page; each settings category
 * lives at its own sub-route (/settings/profile, /settings/learning,
 * /settings/security) under the shared settings layout. Landing on
 * /settings sends the user to the first tab so existing bookmarks keep
 * working.
 */
export default function SettingsIndexPage(): never {
  redirect('/settings/profile')
}
