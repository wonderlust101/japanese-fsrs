import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback shown while PremadeDeckPreviewPage awaits `getPremadeDeckCached`,
 * before PremadePreviewView mounts. Mirrors that view's loading branch: a
 * back-link-only bar with the same static href, so the loaded bar is
 * pixel-identical and never shifts in.
 */
export default function PremadePreviewLoading(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks/premade" ariaLabel="Back to Premade decks" />
			</TopBar>
			<PageLoader />
		</>
	);
}
