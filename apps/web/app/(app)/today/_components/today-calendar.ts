const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DEFAULT_DASHBOARD_TIME_ZONE = "UTC";

const VALID_TIME_ZONE_CACHE = new Map<string, boolean>();
const EDITORIAL_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const DATE_KEY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const GREETING_HOUR_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	timeZone: DEFAULT_DASHBOARD_TIME_ZONE,
});

export interface DashboardCalendarContext {
	dateLabel: string;
	dateTime: string;
	greetingPrefix: string;
	todayKey: string;
	yesterdayKey: string;
	timeZone: string;
}

export function normalizeDashboardTimeZone(timeZone: string | null | undefined): string {
	const candidate = timeZone?.trim() || DEFAULT_DASHBOARD_TIME_ZONE;
	const cached = VALID_TIME_ZONE_CACHE.get(candidate);
	if (cached === true)
		return candidate;
	if (cached === false)
		return DEFAULT_DASHBOARD_TIME_ZONE;

	try {
		dateKeyFormatterForTimeZone(candidate).format(new Date(0));
		VALID_TIME_ZONE_CACHE.set(candidate, true);
		return candidate;
	} catch {
		VALID_TIME_ZONE_CACHE.set(candidate, false);
		return DEFAULT_DASHBOARD_TIME_ZONE;
	}
}

export function buildDashboardCalendarContext(
	date: Date,
	timeZone: string | null | undefined,
): DashboardCalendarContext {
	const normalizedTimeZone = normalizeDashboardTimeZone(timeZone);
	const todayKey = formatDateKeyInTimeZone(date, normalizedTimeZone);

	return {
		dateLabel: formatEditorialDateInTimeZone(date, normalizedTimeZone),
		dateTime: todayKey,
		greetingPrefix: formatGreetingPrefixInTimeZone(date, normalizedTimeZone),
		todayKey,
		yesterdayKey: addDaysToDateKey(todayKey, -1),
		timeZone: normalizedTimeZone,
	};
}

export function calendarDateKeyFromApiDate(
	value: string,
	timeZone: string | null | undefined = DEFAULT_DASHBOARD_TIME_ZONE,
): string {
	if (DATE_KEY_RE.test(value))
		return value;

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()))
		return value.slice(0, 10);
	return formatDateKeyInTimeZone(parsed, normalizeDashboardTimeZone(timeZone));
}

export function isDashboardDateKey(value: string): boolean {
	return DATE_KEY_RE.test(value);
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
	const parts = parseDateKey(dateKey);
	if (parts === null)
		return dateKey;

	const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays));
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function dayLabelForDateKey(dateKey: string): string {
	const parts = parseDateKey(dateKey);
	if (parts === null)
		return "";
	return DAY_LABEL_FORMATTER.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

export function dateNumberFromDateKey(dateKey: string): number {
	return parseDateKey(dateKey)?.day ?? 0;
}

function formatEditorialDateInTimeZone(date: Date, timeZone: string): string {
	return editorialDateFormatterForTimeZone(timeZone).format(date);
}

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
	const parts = dateKeyFormatterForTimeZone(timeZone).formatToParts(date);

	const year = partValue(parts, "year");
	const month = partValue(parts, "month");
	const day = partValue(parts, "day");
	return `${year}-${month}-${day}`;
}

function formatGreetingPrefixInTimeZone(date: Date, timeZone: string): string {
	const parts = greetingHourFormatterForTimeZone(timeZone).formatToParts(date);
	const hour = Number.parseInt(partValue(parts, "hour"), 10);

	if (hour < 12)
		return "Good morning";
	if (hour < 17)
		return "Good afternoon";
	return "Good evening";
}

function editorialDateFormatterForTimeZone(timeZone: string): Intl.DateTimeFormat {
	const cached = EDITORIAL_DATE_FORMATTERS.get(timeZone);
	if (cached !== undefined)
		return cached;

	const formatter = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone,
	});
	EDITORIAL_DATE_FORMATTERS.set(timeZone, formatter);
	return formatter;
}

function dateKeyFormatterForTimeZone(timeZone: string): Intl.DateTimeFormat {
	const cached = DATE_KEY_FORMATTERS.get(timeZone);
	if (cached !== undefined)
		return cached;

	const formatter = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone,
	});
	DATE_KEY_FORMATTERS.set(timeZone, formatter);
	return formatter;
}

function greetingHourFormatterForTimeZone(timeZone: string): Intl.DateTimeFormat {
	const cached = GREETING_HOUR_FORMATTERS.get(timeZone);
	if (cached !== undefined)
		return cached;

	const formatter = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		hour12: false,
		hourCycle: "h23",
		timeZone,
	});
	GREETING_HOUR_FORMATTERS.set(timeZone, formatter);
	return formatter;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
	return parts.find(part => part.type === type)?.value ?? "";
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
	const match = DATE_KEY_RE.exec(dateKey);
	if (match === null)
		return null;

	return {
		year: Number.parseInt(match[1] ?? "", 10),
		month: Number.parseInt(match[2] ?? "", 10),
		day: Number.parseInt(match[3] ?? "", 10),
	};
}
