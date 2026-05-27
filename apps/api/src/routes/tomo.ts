import { Router } from "express";

import * as tomoController from "../controllers/tomo.controller.ts";
import { authMiddleware } from "../middleware/auth.ts";
import {
	aiDailyQuotaMiddleware,
	aiRateLimitMiddleware,
	defaultUserRateLimitMiddleware,
} from "../middleware/rateLimit.ts";

const router = Router();

// Auth → backstop → AI minute-rate → AI daily-quota. Same chain as
// /api/v1/ai because the note endpoint may call OpenAI on cache-miss
// (one call per learner per day max under steady state). The daily quota
// is the hard cap; the minute limiter smooths bursts.
router.use(
	authMiddleware,
	defaultUserRateLimitMiddleware,
	aiRateLimitMiddleware,
	aiDailyQuotaMiddleware,
);

router.get("/note", tomoController.note);

export default router;
