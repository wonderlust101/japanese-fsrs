import { useEffect, useState } from "react";

/**
 * Click-to-copy with a transient confirmation flag. Returns `copied` (true for
 * 1500ms after a successful clipboard write, then auto-resets) and `copy(text)`.
 *
 * Silently no-ops when the Clipboard API is unavailable (older browsers,
 * insecure contexts). Callers that need to surface that failure should pair
 * this hook with their own fallback affordance.
 */
export function useCopyConfirmation(): {
	copied: boolean;
	copy: (text: string) => void;
} {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied)
			return;
		const t = window.setTimeout(setCopied, 1500, false);
		return () => window.clearTimeout(t);
	}, [copied]);

	function copy(text: string): void {
		if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
			return;
		}
		void navigator.clipboard.writeText(text).then(
			() => setCopied(true),
			() => { /* clipboard write blocked; surface stays calm */ },
		);
	}

	return { copied, copy };
}
