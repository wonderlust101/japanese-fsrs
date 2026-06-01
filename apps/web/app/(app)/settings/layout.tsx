import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getProfileAction } from "@/lib/actions/profile.actions";
import { normalizeStudyGoal } from "@/lib/study-goal";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { getUserDisplayName } from "@/lib/supabase/user-metadata";

import { SettingsAllSections } from "./_components/settings-all-sections";
import { SettingsTabBar } from "./_components/settings-rail";

export const metadata: Metadata = { title: "Settings" };

/**
 * Shared chrome for every /settings/* sub-route.
 *
 * Data for all three sections is fetched once here so that switching tabs
 * never triggers a server round-trip or a loading state. `SettingsAllSections`
 * keeps all panels in the DOM simultaneously; the active one uses
 * `display: contents` and inactive ones are hidden with the HTML `hidden`
 * attribute, preserving any dirty form state across tab switches.
 *
 * The sub-route page files (`/profile`, `/learning`, `/security`) are now
 * metadata-only stubs that return null — they exist solely so Next.js can
 * set the per-tab `<title>` and so direct URL navigation works correctly.
 */
export default async function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}): Promise<React.JSX.Element> {
	const [profile, user] = await Promise.all([
		getProfileAction(),
		getAuthUser(),
	]);

	if (profile === null || user === null) {
		redirect("/login");
	}

	const displayName = getUserDisplayName(user) ?? "";
	const studyGoal = profile.studyGoal !== null ? normalizeStudyGoal(profile.studyGoal) : "";

	return (
		<>
			<SettingsTabBar />

			<SettingsAllSections
				email={user.email ?? ""}
				displayName={displayName}
				version={profile.version}
				nativeLanguage={profile.nativeLanguage}
				timezone={profile.timezone}
				studyGoal={studyGoal}
				jlptTarget={profile.jlptTarget}
				dailyNew={profile.dailyNewCardsLimit}
				dailyReview={profile.dailyReviewLimit}
				retention={profile.retentionTarget}
				interests={profile.interests}
			/>

			{/* Sub-route stubs — return null, rendered here only to satisfy Next.js routing */}
			{children}
		</>
	);
}
