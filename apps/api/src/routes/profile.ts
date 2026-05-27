import { Router } from "express";

import * as profileController from "../controllers/profile.controller.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { defaultUserRateLimitMiddleware } from "../middleware/rateLimit.ts";

const router = Router();

// All routes require auth + the per-user backstop limiter (240/min).
router.use(authMiddleware, defaultUserRateLimitMiddleware);

router.get("/", profileController.getProfile);
router.patch("/", profileController.updateProfile);

export default router;
