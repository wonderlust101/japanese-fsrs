import type { Metadata } from "next";

import { StatisticsView } from "./_components/statistics-view";

export const metadata: Metadata = { title: "Insights — Statistics" };

export default function InsightsStatisticsPage(): React.JSX.Element {
	return <StatisticsView />;
}
