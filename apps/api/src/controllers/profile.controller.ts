import type { RequestHandler } from "express";

import { updateProfileSchema } from "@fsrs-japanese/shared-types";
import { cacheControl, parseIfMatchVersion } from "../lib/http.ts";
import * as profileService from "../services/profile.service.ts";

/**
 * GET /api/v1/profile
 * Returns the authenticated user's profile.
 */
export const getProfile: RequestHandler = async (req, res): Promise<void> => {
	const profile = await profileService.getProfile(req.user.id);
	cacheControl(res, 60);
	res.json(profile);
};

/**
 * PATCH /api/v1/profile
 * Partially updates the authenticated user's profile.
 * Only fields present in the request body are written.
 */
export const updateProfile: RequestHandler = async (req, res): Promise<void> => {
	const input = updateProfileSchema.parse(req.body);
	const expectedVersion = parseIfMatchVersion(req.header("if-match"));
	const profile = await profileService.updateProfile(req.user.id, expectedVersion, input);
	res.json(profile);
};
