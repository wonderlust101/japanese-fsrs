import { redirect } from 'next/navigation'

// Temporary entry point until the landing page and auth routes are built.
// New users land here and are sent to the onboarding welcome screen.
export default function RootPage(): never {
  redirect('/onboarding')
}
