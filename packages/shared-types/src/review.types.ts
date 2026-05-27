import type { z } from "zod";

import type { SessionSummarySchema, SessionWeakSpotSchema } from "./schemas/api.schema.ts";

export const ReviewRating = {
	Manual: "manual", // forget / reschedule operations; never a user-facing rating
	Again: "again",
	Hard: "hard",
	Good: "good",
	Easy: "easy",
} as const;
export type ReviewRating = typeof ReviewRating[keyof typeof ReviewRating];

export type SessionWeakSpot = z.infer<typeof SessionWeakSpotSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
