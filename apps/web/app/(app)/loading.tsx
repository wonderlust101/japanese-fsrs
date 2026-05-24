import { PageLoader } from '@/components/ui/TomoLoader'

/**
 * Streamed fallback for every route under (app) whose server component awaits
 * data before rendering (card/deck detail, edit, preview, today, settings, …).
 * Next.js shows this while the matched segment suspends, so navigation paints
 * the canonical page loader instantly instead of hanging on the previous route.
 *
 * It renders inside (app)/layout.tsx, so the sidebar and chrome stay put while
 * only the content area shows the loader. Routes that don't await server-side
 * (thin client shells) render immediately and never trigger this fallback.
 */
export default function AppLoading(): React.JSX.Element {
  return <PageLoader />
}
