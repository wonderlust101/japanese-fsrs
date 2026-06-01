import { TopBar } from "@/app/(app)/_components/top-bar";
import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback shown while EditCardPage awaits the card + deck-list reads. The
 * editor renders a mobile-only `<TopBar desktopHidden>`, so this fallback
 * matches it: the mobile chrome stays continuous across the load, and desktop
 * shows no bar (just as the loaded editor doesn't).
 *
 * Without this file, the edit subtree would inherit the card-detail fallback
 * (a desktop-visible back-link bar) and flash an empty desktop header before
 * the bar-less editor mounted.
 */
export default function EditCardLoading(): React.JSX.Element {
	return (
		<>
			<TopBar desktopHidden />
			<PageLoader />
		</>
	);
}
