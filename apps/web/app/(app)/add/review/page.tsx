import type { Metadata } from "next";

import { GeneratedReviewClient } from "./_components/generated-review-client";

export const metadata: Metadata = { title: "Add Japanese — review" };

export default function GeneratedCardReviewPage(): React.JSX.Element {
	return (
		<div className="flex min-h-full flex-col">
			<GeneratedReviewClient />
		</div>
	);
}
