"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/onboarding` welcome lifecycle dev panel.
 */
export const useOnboardingDevState = createLifecyclePanel({
	id: "onboarding.welcome",
	title: "Onboarding · Welcome",
	states: ["loading"],
});
