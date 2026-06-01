import type { Metadata } from "next";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { buildDashboardCalendarContext } from "@/app/(app)/today/_components/today-calendar";
import { listDecksAction } from "@/lib/actions/decks.actions";
import { getProfileAction } from "@/lib/actions/profile.actions";
import { getDueCardsAction } from "@/lib/actions/reviews.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { currentDate } from "@/lib/runtime";

import { SetupClient } from "./_components/setup-client";

export const metadata: Metadata = { title: "Review setup — tune today" };

export default async function ReviewSetupPage(): Promise<React.JSX.Element> {
	const queryClient = new QueryClient();

	const [profile] = await Promise.all([
		getProfileAction(),
		queryClient.prefetchQuery({
			queryKey: queryKeys.reviews.due(),
			queryFn: getDueCardsAction,
		}),
		queryClient.prefetchQuery({
			queryKey: [...queryKeys.decks.list(), { limit: 500, view: "active" }],
			queryFn: () => listDecksAction({ limit: 500 }),
		}),
	]);

	const calendar = buildDashboardCalendarContext(currentDate(), profile?.timezone);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<SetupClient
				initialTodayKey={calendar.todayKey}
				initialTimeZone={calendar.timeZone}
			/>
		</HydrationBoundary>
	);
}
