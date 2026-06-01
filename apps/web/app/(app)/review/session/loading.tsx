import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback for the review session while the route's RSC payload streams.
 * Deliberately bar-less: the session is a full-screen immersive overlay
 * (SessionOverlay) with its own fixed SessionTopBar. The standard (app)
 * mobile bar from the global fallback would flash the wrong chrome before
 * the overlay covers it, so this segment opts out with a plain loader.
 * Mirrors the equivalent in /weak-spots/drill/[sessionId]/loading.tsx.
 */
export default function ReviewSessionLoading(): React.JSX.Element {
	return <PageLoader />;
}
