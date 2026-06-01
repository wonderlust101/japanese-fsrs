import type { Metadata } from "next";
import { Suspense } from "react";

import { PageLoader } from "@/components/ui/TomoLoader";

// Metadata lives here (not the parent summary/layout.tsx) so the title applies
// to all real-session and fixture views under /review/summary/[sessionId].
export const metadata: Metadata = { title: "Session summary" };

// Suspense boundary satisfies Next.js App Router's requirement for useSearchParams
// (used by the page for the optional ?ended and ?fixture params). For client
// navigation — the only path into this route — React never actually suspends
// here because the URL is fully known before the render; the boundary only
// prevents a hydration warning on direct URL visits where search params are
// not available server-side.
export default function Layout({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<Suspense fallback={<PageLoader />}>
			{children}
		</Suspense>
	);
}
