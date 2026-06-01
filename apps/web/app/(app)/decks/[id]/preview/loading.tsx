import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback shown while DeckPreviewPage awaits `getDeckCached`, before
 * DeckPreviewView mounts. Mirrors that view's loading branch exactly: a
 * back-link-only bar (the deck name isn't known yet). The back href is static,
 * so the loaded bar is pixel-identical and never shifts in.
 */
export default function DeckPreviewLoading(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks/premade" ariaLabel="Back to Premade decks" />
			</TopBar>
			<PageLoader />
		</>
	);
}
