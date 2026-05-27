import type { Metadata } from "next";

import { ProgressView } from "./_components/ProgressView";

export const metadata: Metadata = { title: "Insights — Progress" };

export default function InsightsProgressPage(): React.JSX.Element {
	return <ProgressView />;
}
