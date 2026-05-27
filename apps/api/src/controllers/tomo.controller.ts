import type { RequestHandler } from "express";

import * as tomoNoteService from "../services/tomo-note.service.ts";

/**
 * GET /api/v1/tomo/note
 *
 * Backend Completion Plan Stage 6 — one Tomo daily note per learner per
 * calendar day, surfaced on the review staging page. Cached for the day
 * via Redis (key includes learner-local `dateKey`); when the AI path is
 * unavailable the service substitutes a curated idiom, so this endpoint
 * never returns a 5xx for content-availability reasons (a missing profile
 * still 404s — that's a real data issue).
 */
export const note: RequestHandler = async (req, res): Promise<void> => {
	const data = await tomoNoteService.getTomoNote(req.user.id);
	res.json(data);
};
