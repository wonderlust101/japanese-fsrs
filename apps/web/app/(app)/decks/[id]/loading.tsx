import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback shown while DeckDetailPage awaits `getDeckCached`, before
 * DeckDetailView (and its own loading branch) can mount. Mirrors that
 * branch's titled bar so the back affordance + hanko seal are continuous
 * from the first paint and the loaded bar never shifts in. The deck name
 * isn't known until the await resolves, so the label reads a neutral "Deck"
 * and the real name fades into the same fixed-height bar — no vertical shift.
 */
export default function DeckDetailLoading(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
				<TopBarTitle kanji="束" label="Deck" />
			</TopBar>
			<PageLoader />
		</>
	);
}
