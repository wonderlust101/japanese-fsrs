import { redirect } from 'next/navigation'

/**
 * /signup/verify is in the middleware matcher so that authenticated users are
 * redirected to /dashboard. The actual OTP entry is handled in-component on
 * /signup (no navigation occurs during the signup → verify transition).
 *
 * If a user lands here directly (e.g. a bookmarked or shared URL), send them
 * to /signup so the two-step flow can start from the beginning.
 */
export default function VerifyRedirectPage() {
  redirect('/signup')
}
