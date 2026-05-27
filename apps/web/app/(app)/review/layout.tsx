import type { Metadata } from "next";

// Holds metadata for the client-component page.tsx in this segment (metadata
// can't be exported from a 'use client' file). Sub-segments (session, summary)
// each have their own layout that overrides this title.
export const metadata: Metadata = { title: "Reviews" };

export default function Layout({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <>{children}</>;
}
