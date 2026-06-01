import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { PageLoader } from "@/components/ui/TomoLoader";

export default function InsightsLoading(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarTitle kanji="観" label="Insights" />
			</TopBar>
			<PageLoader />
		</>
	);
}
