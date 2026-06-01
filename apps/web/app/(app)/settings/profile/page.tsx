import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getProfileAction } from "@/lib/actions/profile.actions";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { getUserDisplayName } from "@/lib/supabase/user-metadata";

import { ProfileSection } from "../_components/profile-section";

export const metadata: Metadata = { title: "Settings · Profile" };
export const dynamic = "force-dynamic";

export default async function SettingsProfilePage(): Promise<React.JSX.Element> {
	const [profile, user] = await Promise.all([
		getProfileAction(),
		getAuthUser(),
	]);

	if (profile === null || user === null) {
		redirect("/login");
	}

	const displayName = getUserDisplayName(user) ?? "";

	return (
		<ProfileSection
			email={user.email ?? ""}
			initialVersion={profile.version}
			initialDisplayName={displayName}
			initialNativeLanguage={profile.nativeLanguage}
			initialTimezone={profile.timezone}
			initialStudyGoal={profile.studyGoal ?? ""}
		/>
	);
}
