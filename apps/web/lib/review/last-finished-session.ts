// Tab-scoped handoff for the Review Summary page. The Zustand session store
// is in-memory; a refresh of /review/summary wipes it, so the Summary page
// loses the local-state short-circuit that makes the ended-early-with-no-
// reviews case instant. Storing the handoff in sessionStorage keeps it
// alive across reloads within the same tab and dies with the tab.
//
// Intentionally minimal — only what the Summary page needs to decide
// whether to skip the API. Full session data still lives in the Zustand
// store while it's mounted.

const KEY = "tomo.lastFinishedSession.v1";

export interface LastFinishedSessionRecord {
	sessionId: string;
	historyCount: number;
	endedEarly: boolean;
	storedAt: number;
}

export function rememberLastFinishedSession(record: Omit<LastFinishedSessionRecord, "storedAt">): void {
	if (typeof window === "undefined")
		return;
	try {
		const value: LastFinishedSessionRecord = { ...record, storedAt: Date.now() };
		window.sessionStorage.setItem(KEY, JSON.stringify(value));
	} catch {
		// sessionStorage may throw under quota / private-mode; the page will
		// fall back to the API path and still render correctly.
	}
}

export function readLastFinishedSession(): LastFinishedSessionRecord | null {
	if (typeof window === "undefined")
		return null;
	try {
		const raw = window.sessionStorage.getItem(KEY);
		if (raw === null)
			return null;
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== "object" || parsed === null)
			return null;
		const r = parsed as Partial<LastFinishedSessionRecord>;
		if (typeof r.sessionId === "string"
			&& typeof r.historyCount === "number"
			&& typeof r.endedEarly === "boolean"
			&& typeof r.storedAt === "number") {
			return r as LastFinishedSessionRecord;
		}
		return null;
	} catch {
		return null;
	}
}

export function clearLastFinishedSession(): void {
	if (typeof window === "undefined")
		return;
	try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
