import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback shown while CardDetailPage awaits the card + deck reads, before
 * CardDetailView mounts. Mirrors that view's loading branch (back link only,
 * no title — the word isn't known yet). The card's owning deck is unknown
 * during the await, so the back link points at the cards browser; the loaded
 * view swaps in the precise `/decks/{deckId}` target. The arrow glyph is
 * identical either way, so the swap is invisible and the bar never shifts.
 */
export default function CardDetailLoading(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarBackLink href="/cards" ariaLabel="Back to Cards" />
			</TopBar>
			<PageLoader />
		</>
	);
}
