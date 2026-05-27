"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a key that increments whenever `token` changes after the first mount.
 * Re-key a sentence container with it (`key={swapKey}` + `animate-sentence-swap`
 * when `> 0`) so the entrance animation replays as a visible "the sentence
 * switched" cue when a pager steps to another example.
 *
 * `token` is the example index, not the sentence text, so live edits in the
 * editor preview don't retrigger it. When `token` is undefined (review session,
 * no pager) the key stays at 0 and nothing animates.
 */
export function useSentenceSwapKey(token: number | undefined): number {
	const [swapKey, setSwapKey] = useState(0);
	const prevToken = useRef(token);
	const mounted = useRef(false);

	useEffect(() => {
		if (!mounted.current) {
			mounted.current = true;
			prevToken.current = token;
			return;
		}
		if (token !== undefined && prevToken.current !== token) {
			prevToken.current = token;
			setSwapKey(k => k + 1);
		}
	}, [token]);

	return swapKey;
}
