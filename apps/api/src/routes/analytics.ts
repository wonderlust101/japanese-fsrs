import { Router } from "express";

import * as analyticsController from "../controllers/analytics.controller.ts";
import { authMiddleware } from "../middleware/auth.ts";
import {
	analyticsDashboardRateLimitMiddleware,
	defaultUserRateLimitMiddleware,
} from "../middleware/rateLimit.ts";

const router = Router();

router.use(authMiddleware, defaultUserRateLimitMiddleware);

router.get("/dashboard", analyticsDashboardRateLimitMiddleware, analyticsController.dashboard);

export default router;
