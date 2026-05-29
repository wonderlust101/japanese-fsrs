import { beforeEach, describe, expect, it } from "vitest";

import {
	clearLastFinishedSession,
	readLastFinishedSession,
	rememberLastFinishedSession,
} from "../last-finished-session";

const KEY = "tomo.lastFinishedSession.v1";

beforeEach(() => {
	sessionStorage.clear();
});

describe("last-finished-session handoff", () => {
	it("remember → read round-trips and stamps storedAt", () => {
		rememberLastFinishedSession({ sessionId: "s1", historyCount: 12, endedEarly: false });
		const r = readLastFinishedSession();
		expect(r).not.toBeNull();
		expect(r?.sessionId).toBe("s1");
		expect(r?.historyCount).toBe(12);
		expect(r?.endedEarly).toBe(false);
		expect(typeof r?.storedAt).toBe("number");
	});

	it("read returns null when nothing is stored", () => {
		expect(readLastFinishedSession()).toBeNull();
	});

	it("read returns null on malformed JSON", () => {
		sessionStorage.setItem(KEY, "{not json");
		expect(readLastFinishedSession()).toBeNull();
	});

	it("read returns null on a non-object payload", () => {
		sessionStorage.setItem(KEY, JSON.stringify("a string"));
		expect(readLastFinishedSession()).toBeNull();
	});

	it("read returns null when a required field is missing or mistyped", () => {
		sessionStorage.setItem(KEY, JSON.stringify({ sessionId: "s1", historyCount: "nope", endedEarly: false, storedAt: 1 }));
		expect(readLastFinishedSession()).toBeNull();
	});

	it("clear removes the stored handoff", () => {
		rememberLastFinishedSession({ sessionId: "s2", historyCount: 0, endedEarly: true });
		clearLastFinishedSession();
		expect(readLastFinishedSession()).toBeNull();
	});
});
