"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/login` lifecycle dev panel.
 */
export const useLoginDevState = createLifecyclePanel({
	id: "auth.login",
	title: "Auth · Login",
	states: ["submitting", "error", "success"],
});
