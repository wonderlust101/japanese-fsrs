import type { Metadata } from "next";

import { ReviewSessionClient } from "./_components/review-session-client";

// Thin server shell (audit L4). The route was previously a 524-line
// `"use client"` page, so it could not export metadata. The interactive
// session now lives in ReviewSessionClient; this server entry supplies the
// page title and matches the thin-page pattern every other (app) route uses
// (cards, decks, today, review/setup, …).
export const metadata: Metadata = { title: "Review session" };

export default function ReviewSessionPage(): React.JSX.Element {
	return <ReviewSessionClient />;
}
