"use client";

import type { TopBarOverride } from "@/stores/useTopBarStore";

import { useLayoutEffect } from "react";
import { useTopBarStore } from "@/stores/useTopBarStore";

/**
 * Renders null. Used by pages/views to push dynamic TopBar configuration into
 * the layout-level AppTopBar without unmounting/remounting the header itself.
 *
 * Uses useLayoutEffect so the override lands before the first paint — no
 * single-frame flash of the previous page's title on navigation.
 *
 * On unmount the override is cleared so the next page's route-config title
 * takes over; React batches the cleanup + new setup in the same commit, so
 * AppTopBar re-renders only once with the final state.
 */
export function SetTopBar({
	kanji,
	label,
	labelLang,
	backHref,
	backAriaLabel,
	desktopHidden,
	actions,
}: TopBarOverride): null {
	const setOverride = useTopBarStore(s => s.setOverride);

	useLayoutEffect(() => {
		setOverride({
			...(kanji !== undefined && { kanji }),
			...(label !== undefined && { label }),
			...(labelLang !== undefined && { labelLang }),
			...(backHref !== undefined && { backHref }),
			...(backAriaLabel !== undefined && { backAriaLabel }),
			...(desktopHidden !== undefined && { desktopHidden }),
			...(actions !== undefined && { actions }),
		});
		return () => setOverride(null);
	}, [kanji, label, labelLang, backHref, backAriaLabel, desktopHidden]); // actions excluded — ReactNode can't be in dep array

	return null;
}
