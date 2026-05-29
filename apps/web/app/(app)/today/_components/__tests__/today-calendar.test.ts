import { describe, expect, it } from "vitest";

import {
	addDaysToDateKey,
	buildDashboardCalendarContext,
	calendarDateKeyFromApiDate,
	dateNumberFromDateKey,
	dayLabelForDateKey,
	DEFAULT_DASHBOARD_TIME_ZONE,
	isDashboardDateKey,
	normalizeDashboardTimeZone,
} from "../today-calendar";

describe("normalizeDashboardTimeZone", () => {
	it("returns valid IANA timezones unchanged and falls back to UTC on invalid/empty", () => {
		expect(normalizeDashboardTimeZone("UTC")).toBe("UTC");
		expect(normalizeDashboardTimeZone("America/New_York")).toBe("America/New_York");

		expect(normalizeDashboardTimeZone("Fake/Zone")).toBe(DEFAULT_DASHBOARD_TIME_ZONE);
		expect(normalizeDashboardTimeZone("   ")).toBe(DEFAULT_DASHBOARD_TIME_ZONE);
		expect(normalizeDashboardTimeZone(null)).toBe(DEFAULT_DASHBOARD_TIME_ZONE);
		expect(normalizeDashboardTimeZone(undefined)).toBe(DEFAULT_DASHBOARD_TIME_ZONE);
	});

	it("caches the result on repeated calls with the same input", () => {
		const a = normalizeDashboardTimeZone("Europe/London");
		const b = normalizeDashboardTimeZone("Europe/London");
		expect(a).toBe(b);
		expect(a).toBe("Europe/London");
	});
});

describe("addDaysToDateKey", () => {
	it("crosses month / year boundaries forward and backward", () => {
		expect(addDaysToDateKey("2026-01-31", 1)).toBe("2026-02-01");
		expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
		expect(addDaysToDateKey("2026-03-01", -45)).toBe("2026-01-15");
	});

	it("returns the input unchanged when the key is malformed", () => {
		expect(addDaysToDateKey("not-a-date", 5)).toBe("not-a-date");
		expect(addDaysToDateKey("2026/05/20", 5)).toBe("2026/05/20");
	});

	it("supports zero delta", () => {
		expect(addDaysToDateKey("2026-05-15", 0)).toBe("2026-05-15");
	});
});

describe("calendarDateKeyFromApiDate", () => {
	it("returns YYYY-MM-DD values unchanged and formats ISO timestamps in tz", () => {
		expect(calendarDateKeyFromApiDate("2026-05-27")).toBe("2026-05-27");
		expect(calendarDateKeyFromApiDate("2026-05-27T00:00:00.000Z", "UTC")).toBe("2026-05-27");
	});

	it("returns the first-10-char slice on unparseable input", () => {
		expect(calendarDateKeyFromApiDate("nonsense-string", "UTC")).toBe("nonsense-s");
	});

	it("defaults timezone to UTC when not provided", () => {
		expect(calendarDateKeyFromApiDate("2026-05-27T01:00:00.000Z")).toBe("2026-05-27");
	});
});

describe("isDashboardDateKey", () => {
	it("returns true for valid YYYY-MM-DD shape and false for other shapes", () => {
		expect(isDashboardDateKey("2026-05-27")).toBe(true);

		expect(isDashboardDateKey("2026/05/27")).toBe(false);
		expect(isDashboardDateKey("2026-5-27")).toBe(false);
		expect(isDashboardDateKey("not-a-date")).toBe(false);
		expect(isDashboardDateKey("")).toBe(false);
	});
});

describe("dayLabelForDateKey / dateNumberFromDateKey", () => {
	it("dayLabelForDateKey returns a non-empty weekday string for valid input, '' for invalid", () => {
		expect(dayLabelForDateKey("2026-05-27")).toMatch(/^[A-Z]+$/i);
		expect(dayLabelForDateKey("not-a-date")).toBe("");
	});

	it("dateNumberFromDateKey extracts the day-of-month, 0 for malformed", () => {
		expect(dateNumberFromDateKey("2026-05-27")).toBe(27);
		expect(dateNumberFromDateKey("not-a-date")).toBe(0);
	});
});

describe("buildDashboardCalendarContext greeting prefix boundaries (UTC)", () => {
	function dateAtUtcHour(hour: number): Date {
		return new Date(Date.UTC(2026, 4, 27, hour, 30, 0));
	}

	it("hour 11:30 in UTC → 'Good morning' (boundary just before noon)", () => {
		expect(buildDashboardCalendarContext(dateAtUtcHour(11), "UTC").greetingPrefix).toBe("Good morning");
	});

	it("hour 12:30 in UTC → 'Good afternoon' (boundary just after noon)", () => {
		expect(buildDashboardCalendarContext(dateAtUtcHour(12), "UTC").greetingPrefix).toBe("Good afternoon");
	});

	it("hour 16:30 → 'Good afternoon' and 17:00 → 'Good evening' (5pm boundary)", () => {
		expect(buildDashboardCalendarContext(dateAtUtcHour(16), "UTC").greetingPrefix).toBe("Good afternoon");
		expect(buildDashboardCalendarContext(dateAtUtcHour(17), "UTC").greetingPrefix).toBe("Good evening");
	});

	it("populates todayKey, yesterdayKey, timeZone, and a non-empty dateLabel", () => {
		const ctx = buildDashboardCalendarContext(dateAtUtcHour(10), "UTC");
		expect(ctx.timeZone).toBe("UTC");
		expect(ctx.todayKey).toBe("2026-05-27");
		expect(ctx.yesterdayKey).toBe("2026-05-26");
		expect(ctx.dateLabel.length).toBeGreaterThan(0);
	});

	it("falls back to UTC when the supplied timezone is invalid", () => {
		expect(buildDashboardCalendarContext(dateAtUtcHour(10), "Garbage/Zone").timeZone).toBe("UTC");
	});
});
