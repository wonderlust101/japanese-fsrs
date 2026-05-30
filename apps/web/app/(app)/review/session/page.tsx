import { ReviewSessionClient } from "./_components/review-session-client";

// Thin server shell. The interactive session lives in ReviewSessionClient
// (extracted from a former 524-line `"use client"` page). The route's <title>
// is owned by the sibling `layout.tsx` (`{ title: "Review session" }`), per
// this segment's convention of layout-owned metadata for client pages — so
// this entry deliberately does not redeclare it.
export default function ReviewSessionPage(): React.JSX.Element {
	return <ReviewSessionClient />;
}
