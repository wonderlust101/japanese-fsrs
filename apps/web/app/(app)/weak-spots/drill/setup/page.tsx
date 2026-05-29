import type { Metadata } from "next";

import { DrillSetupClient } from "./_components/drill-setup-client";

export const metadata: Metadata = { title: "Weak spot drill setup" };
export const dynamic = "force-dynamic";

export default function WeakSpotDrillSetupPage(): React.JSX.Element {
	return <DrillSetupClient />;
}
