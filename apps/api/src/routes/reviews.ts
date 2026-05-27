import { Router } from "express";

import * as reviewsController from "../controllers/reviews.controller.ts";
import { authMiddleware } from "../middleware/auth.ts";
import {
	aiDailyQuotaMiddleware,
	aiRateLimitMiddleware,
	batchRateLimitMiddleware,
	defaultUserRateLimitMiddleware,
	submitRateLimitMiddleware,
} from "../middleware/rateLimit.ts";

const router = Router();

router.use(authMiddleware, defaultUserRateLimitMiddleware);

router.get("/due", reviewsController.getDue);
router.post("/submit", submitRateLimitMiddleware, reviewsController.submit);
router.post("/batch", batchRateLimitMiddleware, reviewsController.batch);
router.get("/forecast", reviewsController.forecast);
router.get("/session-summary/:sessionId", reviewsController.sessionSummary);

// Day reflection — post-session AI note over the user-local day's full
// aggregate. Same AI rate-limit + daily-quota chain as the Tomo morning
// note route; the service-level fallback to rule-based prose keeps the
// 200 invariant when the chain throttles or the AI path is degraded.
router.get("/day-reflection/:sessionId",	aiRateLimitMiddleware, aiDailyQuotaMiddleware, reviewsController.dayReflection);

// Batch diagnose every undiagnosed weak spot for a session in one
// operation. Each per-row call hits the AI; chain the AI rate-limit +
// daily-quota middleware so heavy sessions can't burn the user's quota.
router.post("/sessions/:sessionId/diagnose-weak-spots",	aiRateLimitMiddleware, aiDailyQuotaMiddleware, reviewsController.diagnoseSessionWeakSpots);

router.get("/:cardId/preview", reviewsController.previewRatings);

// Stage 8 — rollback a specific review_log by its id. The path is keyed on
// reviewLogId (not cardId) because the log already references its card
// internally. Inherits auth + default rate limiter from `router.use(...)`.
router.post("/:reviewLogId/rollback", reviewsController.rollback);

export default router;
