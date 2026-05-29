import type { Pt } from "../paths";

import { describe, expect, it } from "vitest";

import {
	addDays,
	dayLetter,
	dayOfMonth,
	isoFromDate,
	isWeekEnd,
	niceCeil,
	parseIso,
} from "../dates";
import {
	smoothAreaPath,
	smoothAreaPathWithGaps,
	smoothLinePath,
	smoothLinePathWithGaps,
} from "../paths";

describe("smoothLinePath", () => {
	it("returns '' on empty input, single 'M' for one point", () => {
		expect(smoothLinePath([])).toBe("");
		expect(smoothLinePath([[1, 2]])).toBe("M1.00 2.00");
	});

	it("emits one Catmull-Rom segment for two points, n-1 for n", () => {
		const two = smoothLinePath([[0, 0], [10, 10]]);
		expect(two.startsWith("M0.00 0.00")).toBe(true);
		expect(two.match(/C/g)?.length).toBe(1);

		const five: Pt[] = [[0, 0], [10, 10], [20, 0], [30, 10], [40, 0]];
		expect(smoothLinePath(five).match(/C/g)?.length).toBe(4);
	});
});

describe("smoothLinePathWithGaps", () => {
	it("splits on null entries into separate 'M' subpaths", () => {
		const path = smoothLinePathWithGaps([[0, 0], [1, 1], null, [3, 0], [4, 0]]);
		expect(path.match(/M/g)?.length).toBe(2);
	});

	it("returns '' when input is all null and handles leading null", () => {
		expect(smoothLinePathWithGaps([null, null])).toBe("");
		const leadingNull = smoothLinePathWithGaps([null, [0, 0], [1, 1]]);
		expect(leadingNull.match(/M/g)?.length).toBe(1);
	});
});

describe("smoothAreaPath / smoothAreaPathWithGaps", () => {
	it("returns null for < 2 points; closes back to baseline for >=2", () => {
		expect(smoothAreaPath([], 0)).toBeNull();
		expect(smoothAreaPath([[0, 0]], 0)).toBeNull();

		const closed = smoothAreaPath([[0, 5], [10, 5]], 0) as string;
		expect(closed).toContain("L");
		expect(closed.trimEnd().endsWith("Z")).toBe(true);
	});

	it("joins multiple closed sub-areas for each multi-point run, null when no run reaches 2", () => {
		expect(smoothAreaPathWithGaps([], 0)).toBeNull();
		expect(smoothAreaPathWithGaps([[0, 0], null, [1, 1]], 0)).toBeNull();

		const path = smoothAreaPathWithGaps([
			[0, 0],
			[1, 1],
			null,
			[2, 2],
			[3, 3],
		], 0) as string;
		const zCount = path.split("Z").length - 1;
		expect(zCount).toBe(2);
	});
});

describe("parseIso / isoFromDate / addDays", () => {
	it("parseIso parses YYYY-MM-DD as UTC midnight", () => {
		const d = parseIso("2026-05-27");
		expect(d.getUTCFullYear()).toBe(2026);
		expect(d.getUTCMonth()).toBe(4); // May = 4
		expect(d.getUTCDate()).toBe(27);
		expect(d.getUTCHours()).toBe(0);
	});

	it("isoFromDate round-trips parseIso", () => {
		expect(isoFromDate(parseIso("2026-05-27"))).toBe("2026-05-27");
	});

	it("addDays handles month / year / leap boundaries", () => {
		expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
		expect(addDays("2024-12-30", 5)).toBe("2025-01-04"); // year roll
		expect(addDays("2026-05-15", -10)).toBe("2026-05-05");
	});
});

describe("dayLetter / dayOfMonth / isWeekEnd", () => {
	it("dayLetter returns a single Monday-first letter", () => {
		// 2024-12-30 is a Monday.
		expect(dayLetter("2024-12-30")).toBe("M");
		expect(dayLetter("2024-12-31")).toBe("T");
		expect(dayLetter("2025-01-05")).toBe("S"); // Sunday
	});

	it("dayOfMonth strips the leading zero", () => {
		expect(dayOfMonth("2026-05-01")).toBe("1");
		expect(dayOfMonth("2026-05-15")).toBe("15");
	});

	it("isWeekEnd is true on Sundays in a Monday-first week", () => {
		expect(isWeekEnd("2025-01-05")).toBe(true); // Sunday
		expect(isWeekEnd("2024-12-30")).toBe(false); // Monday
	});
});

describe("niceCeil banded ladder", () => {
	it("ladder up to 200: 5/10/25/50/100/200", () => {
		expect(niceCeil(0)).toBe(5);
		expect(niceCeil(5)).toBe(5);
		expect(niceCeil(6)).toBe(10);
		expect(niceCeil(11)).toBe(25);
		expect(niceCeil(26)).toBe(50);
		expect(niceCeil(51)).toBe(100);
		expect(niceCeil(101)).toBe(200);
	});

	it("ladder 201..500 lands on 500, > 500 rounds up to next 250-multiple", () => {
		expect(niceCeil(201)).toBe(500);
		expect(niceCeil(500)).toBe(500);
		expect(niceCeil(501)).toBe(750);
		expect(niceCeil(751)).toBe(1000);
		expect(niceCeil(1234)).toBe(1250);
	});
});
