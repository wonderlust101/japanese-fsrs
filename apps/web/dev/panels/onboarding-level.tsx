"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/onboarding/level` lifecycle dev panel.
 */
export const useOnboardingLevelDevState = createLifecyclePanel({
	id: "onboarding.level",
	title: "Onboarding · Level",
	states: ["submitting", "error", "success"],
});
