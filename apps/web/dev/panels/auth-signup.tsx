"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/signup` lifecycle dev panel.
 */
export const useSignupDevState = createLifecyclePanel({
	id: "auth.signup",
	title: "Auth · Signup",
	states: ["submitting", "error", "success"],
});
