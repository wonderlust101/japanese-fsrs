import type { RequestHandler } from "express";

import { cacheControl } from "../lib/http.ts";
import * as analyticsService from "../services/analytics.service.ts";
import * as profileService from "../services/profile.service.ts";

const ANALYTICS_MAX_AGE_SECONDS = 300;

/**
 * GET /api/v1/analytics/dashboard
 *
 * Bundled analytics payload — heatmap, accuracy, JLPT gap, milestone
 * forecast, and `cardsAddedThisMonth` — in a single round-trip. The
 * granular endpoints that previously fronted each section were retired
 * 2026-05-18 (zero frontend consumers); the bundled response is the
 * only analytics read path the API exposes today.
 */
export const dashboard: RequestHandler = async (req, res): Promise<void> => {
	const profile = await profileService.getProfileCached(req.user.id);
	const data = await analyticsService.getDashboardData(req.user.id, profile.timezone);
	cacheControl(res, ANALYTICS_MAX_AGE_SECONDS);
	res.json(data);
};
