"use client";

// Legacy redirect: the review summary was previously at /review/summary?id=<sessionId>.
// Real navigation now targets /review/summary/<sessionId> (dynamic route), but this
// page handles old bookmarks and the dev ?fixture= shorthand so neither produces a 404.
//
// Fixture redirect: /review/summary?fixture=<key>  →  /review/summary/_fixture?fixture=<key>
// Session redirect:  /review/summary?id=<id>       →  /review/summary/<id>
// Fallback:          /review/summary                →  /review/setup

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Redirector(): null {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const fixture = searchParams.get("fixture");

	useEffect(() => {
		if (fixture !== null) {
			router.replace(`/review/summary/_fixture?fixture=${encodeURIComponent(fixture)}`);
		} else if (id !== null && id !== "") {
			router.replace(`/review/summary/${encodeURIComponent(id)}`);
		} else {
			router.replace("/review/setup");
		}
	}, [id, fixture, router]);

	return null;
}

export default function LegacySummaryRedirectPage(): React.JSX.Element {
	return (
		<Suspense>
			<Redirector />
		</Suspense>
	);
}
