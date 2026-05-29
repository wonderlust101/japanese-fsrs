import { afterEach, describe, expect, it, vi } from "vitest";

import { randomUUID } from "../random-uuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const realCrypto = globalThis.crypto;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("randomUUID", () => {
	it("uses crypto.randomUUID when available (secure context)", () => {
		const spy = vi.spyOn(realCrypto, "randomUUID");
		const id = randomUUID();
		expect(id).toMatch(UUID_V4);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("falls back to getRandomValues when randomUUID is unavailable (LAN HTTP)", () => {
		vi.stubGlobal("crypto", {
			getRandomValues: realCrypto.getRandomValues.bind(realCrypto),
		});
		const id = randomUUID();
		expect(id).toMatch(UUID_V4);
	});

	it("falls back to Math.random when Web Crypto is entirely absent", () => {
		vi.stubGlobal("crypto", undefined);
		const id = randomUUID();
		expect(id).toMatch(UUID_V4);
	});

	it("produces distinct values across calls", () => {
		expect(randomUUID()).not.toBe(randomUUID());
	});
});
