import type { Metadata } from "next";

import { InsightsOverview } from "./_components/insights-overview";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsOverviewPage(): React.JSX.Element {
	return <InsightsOverview />;
}
