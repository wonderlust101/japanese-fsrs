import type { z } from "zod";

import type {
	ApiWeakSpotDrillAttemptResultSchema,
	ApiWeakSpotDrillAttemptSchema,
	ApiWeakSpotDrillCardSchema,
	ApiWeakSpotDrillSessionDetailCardSchema,
	ApiWeakSpotDrillSessionDetailSchema,
	ApiWeakSpotDrillSessionSchema,
	ApiWeakSpotDrillSessionStatusSchema,
	ApiWeakSpotListItemSchema,
	ApiWeakSpotListResponseSchema,
} from "./schemas/api.schema.ts";

export type ApiWeakSpotListItem = z.infer<typeof ApiWeakSpotListItemSchema>;
export type ApiWeakSpotListResponse = z.infer<typeof ApiWeakSpotListResponseSchema>;

export type ApiWeakSpotDrillCard = z.infer<typeof ApiWeakSpotDrillCardSchema>;
export type ApiWeakSpotDrillSession = z.infer<typeof ApiWeakSpotDrillSessionSchema>;
export type ApiWeakSpotDrillSessionStatus = z.infer<typeof ApiWeakSpotDrillSessionStatusSchema>;

export type ApiWeakSpotDrillSessionDetailCard = z.infer<typeof ApiWeakSpotDrillSessionDetailCardSchema>;
export type ApiWeakSpotDrillSessionDetail = z.infer<typeof ApiWeakSpotDrillSessionDetailSchema>;

export type ApiWeakSpotDrillAttemptResult = z.infer<typeof ApiWeakSpotDrillAttemptResultSchema>;
export type ApiWeakSpotDrillAttempt = z.infer<typeof ApiWeakSpotDrillAttemptSchema>;
