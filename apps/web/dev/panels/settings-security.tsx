"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/settings/security` lifecycle dev panel.
 */
export const useSettingsSecurityDevState = createLifecyclePanel({
	id: "settings.security",
	title: "Settings · Security",
	states: ["loading", "error", "submitting", "success"],
});
