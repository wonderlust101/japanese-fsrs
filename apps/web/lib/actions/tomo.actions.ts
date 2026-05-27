"use server";

import type { ApiTomoNote } from "@fsrs-japanese/shared-types";

import type { z } from "zod";
import {
	ApiTomoNoteSchema,

} from "@fsrs-japanese/shared-types";

import { apiCallSafe } from "@/lib/api/client";

/**
 * Fetches today's Tomo note (`GET /api/v1/tomo/note`). One note per learner
 * per day; the backend caches and idempotently serves the same shape on
 * retry. Uses the safe variant so a quota miss or backend hiccup degrades to
 * silence rather than tearing down Today, matching how the IA treats the
 * pre-session note as ambient orientation.
 *
 * Returns null when the call fails, the response fails schema validation, or
 * the session is unauthenticated. The caller renders nothing in those cases.
 */
const NullableTomoNoteSchema: z.ZodType<ApiTomoNote | null>
	= ApiTomoNoteSchema.nullable();

export async function getTomoNoteAction(): Promise<ApiTomoNote | null> {
	return apiCallSafe<ApiTomoNote | null>(
		"/api/v1/tomo/note",
		NullableTomoNoteSchema,
		{},
		null,
	);
}
