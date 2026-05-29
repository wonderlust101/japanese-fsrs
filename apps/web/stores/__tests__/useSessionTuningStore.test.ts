import type { SessionTuning } from "../useSessionTuningStore";

import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_TUNING, tuningIsModified, useSessionTuningStore } from "../useSessionTuningStore";

const { actions } = useSessionTuningStore.getState();

beforeEach(() => {
	sessionStorage.clear();
	actions.reset();
});

describe("useSessionTuningStore — defaults", () => {
	it("starts at DEFAULT_TUNING", () => {
		const s = useSessionTuningStore.getState();
		expect(s.includeNewCards).toBe(true);
		expect(s.sessionSize).toBe(0);
		expect(s.includedDeckIds).toBeNull();
		expect(s.reviewOrder).toBe("urgency");
	});
});

describe("useSessionTuningStore — actions", () => {
	it("set() updates a single key without disturbing others", () => {
		actions.set("sessionSize", 25);
		const s = useSessionTuningStore.getState();
		expect(s.sessionSize).toBe(25);
		expect(s.includeNewCards).toBe(true); // untouched
	});

	it("applyTuning() replaces all values at once", () => {
		actions.applyTuning({ ...DEFAULT_TUNING, reviewOrder: "shuffle", buryRelated: true });
		const s = useSessionTuningStore.getState();
		expect(s.reviewOrder).toBe("shuffle");
		expect(s.buryRelated).toBe(true);
	});

	it("reset() returns every field to defaults", () => {
		actions.set("overdueFirst", true);
		actions.set("timeboxMinutes", 15);
		actions.reset();
		const s = useSessionTuningStore.getState();
		expect(s.overdueFirst).toBe(false);
		expect(s.timeboxMinutes).toBeNull();
	});

	it("persists tuning to sessionStorage WITHOUT the actions key", () => {
		actions.set("sessionSize", 5);
		const raw = sessionStorage.getItem("tomo.session-tuning");
		expect(raw).not.toBeNull();
		const parsed = JSON.parse(raw as string);
		expect(parsed.state.actions).toBeUndefined();
		expect(parsed.state.sessionSize).toBe(5);
	});
});

describe("tuningIsModified", () => {
	it("is false for the pristine defaults", () => {
		expect(tuningIsModified(DEFAULT_TUNING)).toBe(false);
	});

	const patches: ReadonlyArray<readonly [string, Partial<SessionTuning>]> = [
		["includeNewCards", { includeNewCards: false }],
		["sessionSize", { sessionSize: 20 }],
		["includedDeckIds", { includedDeckIds: ["d1"] }],
		["reviewOrder", { reviewOrder: "shuffle" }],
		["newCardOrder", { newCardOrder: "shuffle" }],
		["overdueFirst", { overdueFirst: true }],
		["timeboxMinutes", { timeboxMinutes: 10 }],
		["buryRelated", { buryRelated: true }],
	];

	it.each(patches)("is true when %s differs from default", (_label, patch) => {
		expect(tuningIsModified({ ...DEFAULT_TUNING, ...patch })).toBe(true);
	});
});
