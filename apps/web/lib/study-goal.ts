import type { OnboardingGoal } from "@/stores/onboarding.store";

// The onboarding goal is a closed enum picked by tapping a card, but
// `profiles.study_goal` is a free-text "one short sentence" (editable later in
// settings, and used to flavour AI example sentences). Persisting the raw enum
// token surfaces machine values like "anime_manga" in the settings textarea, so
// translate the choice into a natural sentence at the persistence boundary.
//
// Lives in its own pure module (no Zustand) so server components can import the
// helpers without pulling the client store's `create()` into their bundle.
export const GOAL_STUDY_SENTENCE: Record<OnboardingGoal, string> = {
	jlpt: "I'm studying to pass the JLPT.",
	anime_manga: "I'm learning Japanese to enjoy anime and manga.",
	novels: "I want to read Japanese novels.",
	life_work: "I'm learning Japanese to live or work in Japan.",
};

/**
 * Coerce a stored `study_goal` value for display. Accounts onboarded before the
 * enum→sentence fix carry a raw token (e.g. "anime_manga") in the DB; map those
 * known tokens to their sentence so settings never shows a machine value. Any
 * other free-text the user typed is passed through untouched.
 */
export function normalizeStudyGoal(value: string): string {
	return value in GOAL_STUDY_SENTENCE
		? GOAL_STUDY_SENTENCE[value as OnboardingGoal]
		: value;
}
