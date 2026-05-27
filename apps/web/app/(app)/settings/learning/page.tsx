import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getProfileAction } from "@/lib/actions/profile.actions";
import { getAuthUser } from "@/lib/supabase/get-auth-user";

import { LearningSection } from "../_components/learning-section";

export const metadata: Metadata = { title: "Settings · Learning" };
export const dynamic = "force-dynamic";

export default async function SettingsLearningPage(): Promise<React.JSX.Element> {
	const [profile, user] = await Promise.all([
		getProfileAction(),
		getAuthUser(),
	]);

	if (profile === null || user === null) {
		redirect("/login");
	}

	return (
		<LearningSection
			initialJlptTarget={profile.jlptTarget}
			initialDailyNew={profile.dailyNewCardsLimit}
			initialDailyReview={profile.dailyReviewLimit}
			initialRetention={profile.retentionTarget}
			initialInterests={profile.interests}
		/>
	);
}
