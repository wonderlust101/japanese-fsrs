import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountdown } from "../use-countdown";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useCountdown", () => {
	it("starts at initialSeconds", () => {
		const { result } = renderHook(() => useCountdown(5));
		expect(result.current.remaining).toBe(5);
	});

	it("decrements once per second (happy path, s > 1)", () => {
		const { result } = renderHook(() => useCountdown(3));
		act(() => { vi.advanceTimersByTime(1000); });
		expect(result.current.remaining).toBe(2);
		act(() => { vi.advanceTimersByTime(1000); });
		expect(result.current.remaining).toBe(1);
	});

	it("floors at 0 on the terminal tick and stops decrementing", () => {
		const { result } = renderHook(() => useCountdown(2));
		act(() => { vi.advanceTimersByTime(5000); });
		expect(result.current.remaining).toBe(0);
		// Interval was cleared on the terminal tick — further time does not go negative.
		act(() => { vi.advanceTimersByTime(5000); });
		expect(result.current.remaining).toBe(0);
	});

	it("restart() resets to initialSeconds and resumes counting", () => {
		const { result } = renderHook(() => useCountdown(3));
		act(() => { vi.advanceTimersByTime(2000); });
		expect(result.current.remaining).toBe(1);
		act(() => { result.current.restart(); });
		expect(result.current.remaining).toBe(3);
		act(() => { vi.advanceTimersByTime(1000); });
		expect(result.current.remaining).toBe(2);
	});

	it("clears the interval on unmount (no further ticks)", () => {
		const { result, unmount } = renderHook(() => useCountdown(3));
		unmount();
		act(() => { vi.advanceTimersByTime(3000); });
		expect(result.current.remaining).toBe(3);
	});
});
