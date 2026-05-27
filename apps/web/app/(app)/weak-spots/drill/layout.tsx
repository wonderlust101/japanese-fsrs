import type { Metadata } from "next";

// Metadata only. The drill flow is intentionally split:
//   - /drill/setup       → inherits the app shell (sidebar visible),
//                          mirroring /review/setup.
//   - /drill/[sessionId] → fixed-overlay zen layout (own layout.tsx),
//                          mirroring /review/session.
//   - /drill/[sessionId]/summary → app shell again (own layout.tsx),
//                          mirroring /review/summary.

export const metadata: Metadata = { title: "Weak spot drill" };

export default function DrillLayout({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	return <>{children}</>;
}
