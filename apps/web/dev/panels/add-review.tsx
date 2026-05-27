"use client";

import { createLifecyclePanel } from "./_factory";

/**
 * `/add/review` lifecycle dev panel. Surfaces the post-capture review-and-tweak
 * states without round-tripping through the AI generator.
 */
export const useAddReviewDevState = createLifecyclePanel({
	id: "add.review",
	title: "Add · Review",
	states: ["loading", "error", "submitting", "success"],
});
