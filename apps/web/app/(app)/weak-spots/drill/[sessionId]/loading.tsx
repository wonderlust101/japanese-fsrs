import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback for the drill session and its nested summary while the dynamic
 * route's RSC payload streams. Deliberately bar-less: the session is a
 * full-screen immersive overlay (SessionOverlay) with its own fixed
 * SessionTopBar, and the summary is a bar-less closure page. The standard
 * (app) mobile bar from the global fallback would flash the wrong chrome
 * before the overlay covers it, so this subtree opts out with a plain loader.
 */
export default function DrillSessionLoading(): React.JSX.Element {
	return <PageLoader />;
}
