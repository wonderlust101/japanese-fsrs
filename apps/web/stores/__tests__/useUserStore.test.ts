import { beforeEach, describe, expect, it } from "vitest";

import { makeProfile } from "../../test/factories/user";
import { useUserStore } from "../useUserStore";

const { actions } = useUserStore.getState();

beforeEach(() => {
	actions.reset();
});

describe("useUserStore — setProfile", () => {
	it("moves idle → loaded carrying the profile", () => {
		const profile = makeProfile();
		actions.setProfile(profile);
		const s = useUserStore.getState();
		expect(s.status).toBe("loaded");
		if (s.status === "loaded")
			expect(s.profile).toEqual(profile);
	});
});

// setLoading is a small state machine: the (status × loading) matrix must map to
// exactly one target status. Cover every cell so a future refactor that breaks a
// transition fails here.
describe("useUserStore — setLoading transitions", () => {
	it("idle → loading", () => {
		actions.setLoading(true);
		expect(useUserStore.getState().status).toBe("loading");
	});

	it("loading → loading (idempotent)", () => {
		actions.setLoading(true);
		actions.setLoading(true);
		expect(useUserStore.getState().status).toBe("loading");
	});

	it("loaded → refreshing", () => {
		actions.setProfile(makeProfile());
		actions.setLoading(true);
		expect(useUserStore.getState().status).toBe("refreshing");
	});

	it("refreshing → refreshing (idempotent)", () => {
		actions.setProfile(makeProfile());
		actions.setLoading(true);
		actions.setLoading(true);
		expect(useUserStore.getState().status).toBe("refreshing");
	});

	it("idle → idle when loading=false", () => {
		actions.setLoading(false);
		expect(useUserStore.getState().status).toBe("idle");
	});

	it("loading → idle when loading=false", () => {
		actions.setLoading(true);
		actions.setLoading(false);
		expect(useUserStore.getState().status).toBe("idle");
	});

	it("refreshing → loaded when loading=false", () => {
		actions.setProfile(makeProfile());
		actions.setLoading(true); // → refreshing
		actions.setLoading(false); // → loaded
		expect(useUserStore.getState().status).toBe("loaded");
	});

	it("loaded → loaded when loading=false (idempotent)", () => {
		actions.setProfile(makeProfile());
		actions.setLoading(false);
		expect(useUserStore.getState().status).toBe("loaded");
	});
});

describe("useUserStore — updatePreferences", () => {
	it("shallow-merges into a loaded profile", () => {
		actions.setProfile(makeProfile({ dailyNewCardsLimit: 10 }));
		actions.updatePreferences({ dailyNewCardsLimit: 25 });
		const s = useUserStore.getState();
		expect(s.status === "loaded" ? s.profile.dailyNewCardsLimit : null).toBe(25);
	});

	it("merges while refreshing and preserves the refreshing status", () => {
		actions.setProfile(makeProfile());
		actions.setLoading(true); // → refreshing
		actions.updatePreferences({ jlptTarget: "N1" });
		const s = useUserStore.getState();
		expect(s.status).toBe("refreshing");
		expect(s.status === "refreshing" ? s.profile.jlptTarget : null).toBe("N1");
	});

	it("is a no-op when idle (no profile to merge into)", () => {
		actions.updatePreferences({ jlptTarget: "N1" });
		expect(useUserStore.getState().status).toBe("idle");
	});

	it("is a no-op when loading", () => {
		actions.setLoading(true);
		actions.updatePreferences({ jlptTarget: "N1" });
		expect(useUserStore.getState().status).toBe("loading");
	});
});

describe("useUserStore — reset", () => {
	it("returns to idle and drops the profile", () => {
		actions.setProfile(makeProfile());
		actions.reset();
		expect(useUserStore.getState().status).toBe("idle");
	});
});
