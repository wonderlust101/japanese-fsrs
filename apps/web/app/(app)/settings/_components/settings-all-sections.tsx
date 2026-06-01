"use client";

import { usePathname } from "next/navigation";

import { LearningSection } from "./learning-section";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";

interface Props {
	email: string;
	displayName: string;
	version: number;
	nativeLanguage: string;
	timezone: string;
	studyGoal: string;
	jlptTarget: string | null;
	dailyNew: number;
	dailyReview: number;
	retention: number;
	interests: string[];
}

function sectionFromPathname(pathname: string): "profile" | "learning" | "security" {
	const segments = pathname.split("/").filter(s => s.length > 0);
	const seg = segments[1];
	if (seg === "learning" || seg === "security")
		return seg;
	return "profile";
}

/**
 * Renders all three settings sections simultaneously so the tab bar never
 * triggers a data fetch or a loading state. The active section uses
 * `display: contents` (the `contents` Tailwind utility) so its two fragment
 * children — the content column and the optional ContextStrip — participate
 * directly in the flex row. Inactive sections carry the HTML `hidden` attribute
 * which forces `display: none !important`, keeping them in the DOM (state
 * preserved) but invisible and outside the layout flow.
 */
export function SettingsAllSections({
	email,
	displayName,
	version,
	nativeLanguage,
	timezone,
	studyGoal,
	jlptTarget,
	dailyNew,
	dailyReview,
	retention,
	interests,
}: Props): React.JSX.Element {
	const active = sectionFromPathname(usePathname());

	return (
		<section
			aria-label="Settings"
			className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-12 lg:px-16 lg:py-12"
		>
			<div className="flex gap-10 xl:gap-14">
				<div hidden={active !== "profile"} className="contents">
					<ProfileSection
						email={email}
						initialVersion={version}
						initialDisplayName={displayName}
						initialNativeLanguage={nativeLanguage}
						initialTimezone={timezone}
						initialStudyGoal={studyGoal}
					/>
				</div>
				<div hidden={active !== "learning"} className="contents">
					<LearningSection
						initialVersion={version}
						initialJlptTarget={jlptTarget}
						initialDailyNew={dailyNew}
						initialDailyReview={dailyReview}
						initialRetention={retention}
						initialInterests={interests}
					/>
				</div>
				<div hidden={active !== "security"} className="contents">
					<SecuritySection />
				</div>
			</div>
		</section>
	);
}
