import type { Metadata } from "next";

import { DrillSummaryClient } from "./_components/drill-summary-client";

export const metadata: Metadata = { title: "Weak spot drill summary" };
export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ sessionId: string }>;
}

export default async function WeakSpotDrillSummaryPage({
	params,
}: PageProps): Promise<React.JSX.Element> {
	const { sessionId } = await params;
	return <DrillSummaryClient sessionId={sessionId} />;
}
