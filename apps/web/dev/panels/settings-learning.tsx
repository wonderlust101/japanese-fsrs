"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/settings/learning` lifecycle dev panel.
 */
export const useSettingsLearningDevState = createLifecyclePanel({
	id: "settings.learning",
	title: "Settings · Learning",
	states: ["loading", "error", "submitting", "success"],
});
