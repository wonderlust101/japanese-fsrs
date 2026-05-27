"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/settings/profile` lifecycle dev panel.
 */
export const useSettingsProfileDevState = createLifecyclePanel({
	id: "settings.profile",
	title: "Settings · Profile",
	states: ["loading", "error", "submitting", "success"],
});
