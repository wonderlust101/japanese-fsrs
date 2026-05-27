import type { Metadata } from "next";

import { buildDashboardCalendarContext } from "@/app/(app)/today/_components/today-calendar";
import { getProfileAction } from "@/lib/actions/profile.actions";

import { TopBar } from "../_components/top-bar";

import { AddClient } from "./_components/add-client";

export const metadata: Metadata = { title: "Add Japanese — capture" };

export default async function AddJapanesePage(): Promise<React.JSX.Element> {
	const profile = await getProfileAction();
	const calendar = buildDashboardCalendarContext(new Date(), profile?.timezone);

	return (
		<>
			<TopBar desktopHidden />
			<div className="flex min-h-full flex-col pb-40 lg:pb-32">
				<AddClient todayKey={calendar.todayKey} />
			</div>
		</>
	);
}
