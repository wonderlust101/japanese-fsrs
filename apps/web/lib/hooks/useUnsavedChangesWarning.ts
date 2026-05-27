"use client";

import { useEffect } from "react";

/**
 * Prompts the browser's native "Leave site?" dialog while `isDirty` is true, so
 * a hard navigation, tab close, or reload doesn't silently discard unsaved form
 * work. The listener attaches only while dirty and is removed when the form goes
 * clean or the component unmounts.
 *
 * Scope: this covers *hard* navigation only. Next.js App Router has no stable
 * API to block *soft* in-app navigation (clicking a `<Link>` / router.push), so
 * this does not guard a sidebar click. Pair it with a real dirty flag at the
 * call site (e.g. "the user edited a field") so a pristine form never prompts.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
	useEffect(() => {
		if (!isDirty)
			return;
		const handler = (e: BeforeUnloadEvent): void => {
			e.preventDefault();
			// Some browsers still require returnValue to be set to show the prompt.
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [isDirty]);
}
