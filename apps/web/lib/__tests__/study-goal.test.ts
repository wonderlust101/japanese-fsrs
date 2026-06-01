import { describe, expect, it } from "vitest";

import { GOAL_STUDY_SENTENCE, normalizeStudyGoal } from "../study-goal";

describe("study-goal", () => {
	it("maps every onboarding goal enum to a non-empty sentence", () => {
		for (const sentence of Object.values(GOAL_STUDY_SENTENCE)) {
			expect(sentence.trim().length).toBeGreaterThan(0);
			// A real sentence, not a machine token (no snake_case leakage).
			expect(sentence).not.toMatch(/_/);
		}
	});

	it("normalizes a legacy enum token to its sentence", () => {
		expect(normalizeStudyGoal("anime_manga")).toBe(
			GOAL_STUDY_SENTENCE.anime_manga,
		);
		expect(normalizeStudyGoal("jlpt")).toBe(GOAL_STUDY_SENTENCE.jlpt);
	});

	it("passes free-text the user typed through untouched", () => {
		const typed = "Reading novels by next spring.";
		expect(normalizeStudyGoal(typed)).toBe(typed);
	});

	it("does not coerce the empty string", () => {
		expect(normalizeStudyGoal("")).toBe("");
	});
});
