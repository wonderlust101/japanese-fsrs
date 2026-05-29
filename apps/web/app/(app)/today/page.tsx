import type { Metadata } from "next";

import { getProfileAction } from "@/lib/actions/profile.actions";
import { currentDate } from "@/lib/runtime";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { getUserDisplayName } from "@/lib/supabase/user-metadata";

import { TopBar } from "../_components/top-bar";

import { buildDashboardCalendarContext } from "./_components/today-calendar";
import { DashboardClient } from "./_components/today-client";

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
	const [user, profile] = await Promise.all([
		getAuthUser(),
		getProfileAction(),
	]);
	const calendar = buildDashboardCalendarContext(today, profile?.timezone);
	const greetingName = firstName(getUserDisplayName(user));

	return (
		<>
			<TopBar desktopHidden />

			<div className="flex min-h-screen flex-col">
				<DashboardClient
					dateLabel={calendar.dateLabel}
					dateTime={calendar.dateTime}
					greetingName={greetingName}
					greetingPrefix={calendar.greetingPrefix}
					timeZone={calendar.timeZone}
				/>
			</div>
		</>
	);
}
