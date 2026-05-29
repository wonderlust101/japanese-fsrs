import type { OnboardingStepPath } from "../onboarding.store";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useOnboardingStore } from "../onboarding.store";

// Cached once — the actions object reference is stable across resets.
const actions = useOnboardingStore.getState().actions;

beforeEach(() => {
	sessionStorage.clear();
	actions.reset();
});

afterEach(() => {
	actions.reset();
});

describe("useOnboardingStore — initial state", () => {
	it("starts with all answers cleared", () => {
		const s = useOnboardingStore.getState();
		expect(s.level).toBeNull();
		expect(s.goal).toBeNull();
		expect(s.interests).toEqual([]);
		expect(s.schedule).toBeNull();
		expect(s.selectedDeckIds).toEqual([]);
	});
});

describe("useOnboardingStore — simple setters", () => {
	it("setLevel / setGoal / setSchedule store and clear with null", () => {
		actions.setLevel("N3");
		actions.setGoal("anime_manga");
		actions.setSchedule("intensive");
		expect(useOnboardingStore.getState().level).toBe("N3");
		expect(useOnboardingStore.getState().goal).toBe("anime_manga");
		expect(useOnboardingStore.getState().schedule).toBe("intensive");

		actions.setLevel(null);
		actions.setGoal(null);
		actions.setSchedule(null);
		expect(useOnboardingStore.getState().level).toBeNull();
		expect(useOnboardingStore.getState().goal).toBeNull();
		expect(useOnboardingStore.getState().schedule).toBeNull();
	});

	it("setInterests replaces the list entirely", () => {
		actions.setInterests(["anime", "games"]);
		expect(useOnboardingStore.getState().interests).toEqual(["anime", "games"]);
		actions.setInterests([]);
		expect(useOnboardingStore.getState().interests).toEqual([]);
	});

	it("setSelectedDeckIds replaces the list entirely", () => {
		actions.setSelectedDeckIds(["d1", "d2"]);
		expect(useOnboardingStore.getState().selectedDeckIds).toEqual(["d1", "d2"]);
	});
});

describe("useOnboardingStore — toggleInterest", () => {
	it("adds when missing, in append order", () => {
		actions.toggleInterest("anime");
		actions.toggleInterest("games");
		expect(useOnboardingStore.getState().interests).toEqual(["anime", "games"]);
	});

	it("removes when present (no reordering of remaining entries)", () => {
		actions.toggleInterest("anime");
		actions.toggleInterest("games");
		actions.toggleInterest("anime"); // remove
		expect(useOnboardingStore.getState().interests).toEqual(["games"]);
	});
});

describe("useOnboardingStore — applyStepDefault (exhaustive per step)", () => {
	const cases: ReadonlyArray<{ step: OnboardingStepPath; assert: () => void }> = [
		{ step: "/onboarding/level", assert: () => expect(useOnboardingStore.getState().level).toBe("beginner") },
		{ step: "/onboarding/goal", assert: () => expect(useOnboardingStore.getState().goal).toBe("jlpt") },
		{ step: "/onboarding/interests", assert: () => expect(useOnboardingStore.getState().interests).toEqual([]) },
		{ step: "/onboarding/schedule", assert: () => expect(useOnboardingStore.getState().schedule).toBe("steady") },
		{ step: "/onboarding/decks", assert: () => expect(useOnboardingStore.getState().selectedDeckIds).toEqual([]) },
	];

	it.each(cases)("$step applies its default", ({ step, assert }) => {
		actions.applyStepDefault(step);
		assert();
	});
});

describe("useOnboardingStore — applyAllDefaults", () => {
	it("fills only unset answers", () => {
		actions.setLevel("N1");
		actions.applyAllDefaults();
		const s = useOnboardingStore.getState();
		expect(s.level).toBe("N1"); // preserved
		expect(s.goal).toBe("jlpt"); // defaulted
		expect(s.schedule).toBe("steady"); // defaulted
	});

	it("populates missing answers from a clean slate", () => {
		actions.applyAllDefaults();
		const s = useOnboardingStore.getState();
		expect(s.level).toBe("beginner");
		expect(s.goal).toBe("jlpt");
		expect(s.schedule).toBe("steady");
	});
});

describe("useOnboardingStore — reset", () => {
	it("returns every answer to initial state", () => {
		actions.setLevel("N1");
		actions.setGoal("novels");
		actions.toggleInterest("anime");
		actions.setSchedule("intensive");
		actions.setSelectedDeckIds(["d1"]);

		actions.reset();
		const s = useOnboardingStore.getState();
		expect(s.level).toBeNull();
		expect(s.goal).toBeNull();
		expect(s.interests).toEqual([]);
		expect(s.schedule).toBeNull();
		expect(s.selectedDeckIds).toEqual([]);
	});
});

describe("useOnboardingStore — partialize excludes 'actions' from persistence", () => {
	it("the persisted JSON does not contain the actions key", () => {
		actions.setLevel("N3");
		const raw = sessionStorage.getItem("fsrs-onboarding");
		expect(raw).not.toBeNull();
		const parsed = JSON.parse(raw as string);
		expect(parsed.state).toBeDefined();
		expect(parsed.state.actions).toBeUndefined();
		expect(parsed.state.level).toBe("N3");
	});
});
