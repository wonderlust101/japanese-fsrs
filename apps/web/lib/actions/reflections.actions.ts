"use server";

import type { ApiDayReflection } from "@fsrs-japanese/shared-types";

import type { z } from "zod";
import {
	ApiDayReflectionSchema,

} from "@fsrs-japanese/shared-types";

import { apiCallSafe } from "@/lib/api/client";

// Day-reflection wire shape allows `null` from the safe action when the
// call fails, the response is not schema-valid, or the user is not signed
// in. The Session details card silently falls back to the deterministic
// `content.diagnosisLead` prose in those cases — the AI reflection is an
// enhancement, never a hard dependency.
const NullableDayReflectionSchema: z.ZodType<ApiDayReflection | null>
	= ApiDayReflectionSchema.nullable();

/**
 * Fetches the Tomo-voice post-session reflection for the user-local day
 * that contains the given sessionId. Aggregates all sessions on that day;
 * the backend regenerates whenever a new session is added.
 *
 * Returns null on failure so the caller can render the deterministic
 * fallback prose without an error boundary.
 */
export async function getDayReflectionAction(
	sessionId: string,
): Promise<ApiDayReflection | null> {
	return apiCallSafe<ApiDayReflection | null>(
		`/api/v1/reviews/day-reflection/${encodeURIComponent(sessionId)}`,
		NullableDayReflectionSchema,
		{},
		null,
	);
}
