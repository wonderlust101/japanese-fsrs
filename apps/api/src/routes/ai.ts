import { Router } from "express";

import * as aiController from "../controllers/ai.controller.ts";
import { authMiddleware } from "../middleware/auth.ts";
import {
	aiDailyQuotaMiddleware,
	aiRateLimitMiddleware,
	defaultUserRateLimitMiddleware,
} from "../middleware/rateLimit.ts";

const router = Router();

// Every AI route runs auth → backstop → AI minute-rate → AI daily quota.
router.use(
	authMiddleware,
	defaultUserRateLimitMiddleware,
	aiRateLimitMiddleware,
	aiDailyQuotaMiddleware,
);

router.post("/generate-card", aiController.generateCard);
router.post("/generate-sentences", aiController.generateSentences);
router.post("/generate-mnemonic", aiController.generateMnemonic);

export default router;
