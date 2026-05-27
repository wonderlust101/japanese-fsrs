export const DEFAULT_TIME_ZONE = "UTC";

export function normalizeTimeZone(timeZone: string | null | undefined): string {
	const candidate = timeZone?.trim() || DEFAULT_TIME_ZONE;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date(0));
		return candidate;
	} catch {
		return DEFAULT_TIME_ZONE;
	}
}
