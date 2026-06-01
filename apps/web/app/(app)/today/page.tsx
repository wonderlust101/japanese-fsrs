import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { listDecksWithStatsAction } from "@/lib/actions/decks.actions";
import { getProfileAction } from "@/lib/actions/profile.actions";
import { getDueCardsAction, getReviewForecastAction } from "@/lib/actions/reviews.actions";
import { listWeakSpotsAction } from "@/lib/actions/weak-spots.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { currentDate } from "@/lib/runtime";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { getUserDisplayName } from "@/lib/supabase/user-metadata";

import { buildDashboardCalendarContext } from "./_components/today-calendar";
import { DashboardClient } from "./_components/today-client";
import { WEAK_SPOT_QUERY_LIMIT } from "./_components/today-hero";

export const metadata: Metadata = { title: "Today" };

function firstName(displayName: string | undefined): string | null {
	const trimmed = displayName?.trim();
	if (trimmed == null || trimmed.length === 0)
		return null;
	return trimmed.split(/\s+/)[0] ?? null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage(): Promise<React.JSX.Element> {
	const today = currentDate();

	// Fresh QueryClient per request — never reused across users.
	const queryClient = new QueryClient();

	// Start all six async operations simultaneously so the total server wait
	// is max(slowest), not sum(all). prefetchQuery uses getSession (cookie read,
	// no JWT round-trip) so it starts immediately without waiting for getUser.
	const prefetchDone = Promise.allSettled([
		queryClient.prefetchQuery({
			queryKey: [...queryKeys.decks.list(), { limit: 8, view: "active", withStats: true }],
			queryFn: () => listDecksWithStatsAction({ limit: 8 }),
		}),
		queryClient.prefetchQuery({
			queryKey: queryKeys.reviews.due(),
			queryFn: getDueCardsAction,
		}),
		queryClient.prefetchQuery({
			queryKey: queryKeys.reviews.forecast(),
			queryFn: getReviewForecastAction,
		}),
		queryClient.prefetchQuery({
			queryKey: queryKeys.weakSpots.list({ status: "unresolved", limit: WEAK_SPOT_QUERY_LIMIT, sort: "mostRecent" }),
			queryFn: () => listWeakSpotsAction({ status: "unresolved", limit: WEAK_SPOT_QUERY_LIMIT, sort: "mostRecent" }),
		}),
	]);

	const [user, profile] = await Promise.all([
		getAuthUser(),
		getProfileAction(),
	]);

	// Ensure all prefetches have settled before dehydrating — errors are
	// swallowed by allSettled so a slow API never blocks the page render.
	await prefetchDone;

	const calendar = buildDashboardCalendarContext(today, profile?.timezone);
	const greetingName = firstName(getUserDisplayName(user));

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<div className="flex min-h-screen flex-col">
				<DashboardClient
					dateLabel={calendar.dateLabel}
					dateTime={calendar.dateTime}
					greetingName={greetingName}
					greetingPrefix={calendar.greetingPrefix}
					timeZone={profile?.timezone !== "UTC" ? (profile?.timezone ?? null) : null}
					profileVersion={profile?.version ?? null}
				/>
			</div>
		</HydrationBoundary>
	);
}
