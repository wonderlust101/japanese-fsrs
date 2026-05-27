import type { Metadata } from "next";

import { InsightsOverview } from "./_components/InsightsOverview";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsOverviewPage(): React.JSX.Element {
	return <InsightsOverview />;
}
