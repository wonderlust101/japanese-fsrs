import type { Metadata } from "next";

import { buildDashboardCalendarContext } from "@/app/(app)/today/_components/today-calendar";
import { getProfileAction } from "@/lib/actions/profile.actions";
import { currentDate } from "@/lib/runtime";

import { TopBar } from "../../_components/top-bar";

import { SetupClient } from "./_components/setup-client";

export const metadata: Metadata = { title: "Review setup — tune today" };

export default async function ReviewSetupPage(): Promise<React.JSX.Element> {
	const profile = await getProfileAction();
	const calendar = buildDashboardCalendarContext(currentDate(), profile?.timezone);

	return (
		<>
			<TopBar desktopHidden />

			<div className="flex min-h-full flex-col pb-40 lg:pb-32">
				<SetupClient
					initialTodayKey={calendar.todayKey}
					initialTimeZone={calendar.timeZone}
				/>
			</div>
		</>
	);
}
