import type { Metadata } from "next";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { buildDashboardCalendarContext } from "@/app/(app)/today/_components/today-calendar";
import { listDecksAction } from "@/lib/actions/decks.actions";
import { getProfileAction } from "@/lib/actions/profile.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { currentDate } from "@/lib/runtime";

import { AddClient } from "./_components/add-client";

export const metadata: Metadata = { title: "Add Japanese — capture" };

export default async function AddJapanesePage(): Promise<React.JSX.Element> {
	const queryClient = new QueryClient();

	const [profile] = await Promise.all([
		getProfileAction(),
		queryClient.prefetchQuery({
			queryKey: [...queryKeys.decks.list(), { limit: 50, view: "active" }],
			queryFn: () => listDecksAction({ limit: 50 }),
		}),
	]);

	const calendar = buildDashboardCalendarContext(currentDate(), profile?.timezone);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<div className="flex min-h-full flex-col pb-40 lg:pb-32">
				<AddClient todayKey={calendar.todayKey} />
			</div>
		</HydrationBoundary>
	);
}
