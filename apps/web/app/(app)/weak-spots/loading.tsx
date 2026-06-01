import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { PageLoader } from "@/components/ui/TomoLoader";

export default function WeakSpotsLoading(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarTitle kanji="弱" label="Weak spots" />
			</TopBar>
			<PageLoader />
		</>
	);
}
