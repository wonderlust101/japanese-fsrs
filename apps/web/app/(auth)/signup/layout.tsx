import type { Metadata } from "next";

// Holds metadata for the client-component page.tsx in this segment (metadata
// can't be exported from a 'use client' file).
export const metadata: Metadata = { title: "Create account" };

export default function Layout({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <>{children}</>;
}
