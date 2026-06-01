import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Streamed fallback for every route under (app) whose server component awaits
 * data before rendering. Next.js shows this while the matched segment suspends.
 *
 * The TopBar is now the persistent AppTopBar in (app)/layout.tsx — it never
 * unmounts, so there's no need to re-render it here as a fallback.
 */
export default function AppLoading(): React.JSX.Element {
	return <PageLoader />;
}
