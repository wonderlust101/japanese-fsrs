import { beforeEach, describe, expect, it } from "vitest";

import { useMobileNavStore } from "../useMobileNavStore";

beforeEach(() => {
	useMobileNavStore.setState({ isOpen: false });
});

describe("useMobileNavStore", () => {
	it("starts closed", () => {
		expect(useMobileNavStore.getState().isOpen).toBe(false);
	});

	it("open() sets isOpen true", () => {
		useMobileNavStore.getState().open();
		expect(useMobileNavStore.getState().isOpen).toBe(true);
	});

	it("close() sets isOpen false", () => {
		useMobileNavStore.getState().open();
		useMobileNavStore.getState().close();
		expect(useMobileNavStore.getState().isOpen).toBe(false);
	});

	it("toggle() flips isOpen in both directions", () => {
		useMobileNavStore.getState().toggle();
		expect(useMobileNavStore.getState().isOpen).toBe(true);
		useMobileNavStore.getState().toggle();
		expect(useMobileNavStore.getState().isOpen).toBe(false);
	});
});
