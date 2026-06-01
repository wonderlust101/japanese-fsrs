"use client";

import type { UpdateProfileInput } from "@fsrs-japanese/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { updateProfileAction } from "@/lib/actions/profile.actions";

/**
 * Serializes profile PATCHes, carries the optimistic-concurrency version, and
 * refetches dependent data after each successful write.
 *
 * `PATCH /api/v1/profile` is guarded by `If-Match`: every successful write
 * bumps the row's `version`, so the next write must send the bumped value or
 * the API responds 412. Settings fields auto-save independently, and the
 * profile section commits several at once (`Promise.all`), so writes are
 * funnelled through a single promise chain here: each awaits the previous,
 * sends the current version, and advances it from the returned profile. That
 * keeps rapid or parallel field commits from colliding on a stale version
 * (which would surface as a spurious "Could not save").
 *
 * After a write lands, every server-derived query is invalidated. Profile
 * settings ripple widely — daily limits + timezone drive the due/new queues,
 * forecast and dashboard; retention + timezone drive the insights charts; the
 * shared `profile` query backs several screens; timezone even rekeys the Tomo
 * note. A broad refetch is deliberate here (vs. the narrow `useCopyPremadeDeck`
 * invalidation) and safe because a settings commit is a rare, user-initiated
 * event, not the high-frequency trigger the global refetch tuning guards
 * against.
 *
 * Returns a stable `save(payload)` that resolves when the caller's own write
 * lands and rejects with its error, so the existing per-field success/error
 * feedback keeps working. A rejected write doesn't wedge the chain — the
 * version simply isn't advanced, so the next write retries from the last
 * known-good value. The refetch is fire-and-forget: `save` resolves (and its
 * ✓ tick fires) without waiting on the dependent queries.
 */
export function useProfileMutation(
	initialVersion: number,
): (payload: UpdateProfileInput) => Promise<void> {
	const queryClient = useQueryClient();
	// Init-only on purpose: once mounted, the chain owns the live version
	// (advanced on every successful write), which is always at least as fresh
	// as a re-passed `initialVersion` would be.
	const versionRef = useRef(initialVersion);
	const chainRef = useRef<Promise<unknown>>(Promise.resolve());

	return useCallback((payload: UpdateProfileInput): Promise<void> => {
		const run = chainRef.current.then(async (): Promise<void> => {
			const updated = await updateProfileAction(versionRef.current, payload);
			versionRef.current = updated.version;
			// Settings ripple into due counts, forecasts, insights, and the shared
			// profile query — refetch everything server-derived. Fire-and-forget so
			// the caller's save resolves without waiting on the refetches.
			void queryClient.invalidateQueries();
		});
		// Swallow only on the chain copy so one failure doesn't reject every
		// queued write; the returned `run` still rejects for this caller.
		chainRef.current = run.catch(() => undefined);
		return run;
	}, [queryClient]);
}
