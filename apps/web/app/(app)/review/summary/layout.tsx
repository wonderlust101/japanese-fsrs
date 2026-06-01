// Outer layout for the /review/summary segment. The nested [sessionId]/layout.tsx
// holds the actual metadata and Suspense boundary for all real + fixture views.
export default function Layout({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <>{children}</>;
}
