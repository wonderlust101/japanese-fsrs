"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/onboarding/decks` lifecycle dev panel.
 */
export const useOnboardingDecksDevState = createLifecyclePanel({
	id: "onboarding.decks",
	title: "Onboarding · Decks",
	states: ["loading", "error", "submitting", "success"],
});
