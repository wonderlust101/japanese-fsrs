"use client";

import { usePathname } from "next/navigation";

import { useTopBarStore } from "@/stores/useTopBarStore";

import { TopBar } from "./top-bar";
import { TopBarBackLink } from "./top-bar-back-link";
import { TopBarTitle } from "./top-bar-title";

interface RouteTopBarConfig {
	kanji?: string;
	label?: string;
	labelLang?: string;
	backHref?: string;
	backAriaLabel?: string;
	desktopHidden?: boolean;
}

/**
 * Returns the static TopBar config for a given pathname. Covers every standard
 * (app) route; dynamic values (deck/card titles, actions) are injected on top
 * via the useTopBarStore override set by SetTopBar.
 */
function getRouteConfig(pathname: string): RouteTopBarConfig {
	if (pathname === "/today")
		return { desktopHidden: true };
	if (pathname === "/add" || pathname === "/add/review")
		return { desktopHidden: true };
	if (pathname === "/review/setup")
		return { desktopHidden: true };
	if (pathname.startsWith("/review/summary/"))
		return { kanji: "済", label: "Session summary", backHref: "/today", backAriaLabel: "Back to Today" };

	if (pathname === "/cards")
		return { kanji: "札", label: "Cards" };
	if (/^\/cards\/[^/]+\/edit/.test(pathname))
		return { desktopHidden: true };
	if (/^\/cards\/[^/]+/.test(pathname))
		return { backHref: "/cards", backAriaLabel: "Back to Cards" };

	if (pathname === "/decks")
		return { kanji: "束", label: "Decks" };
	if (pathname === "/decks/premade")
		return { kanji: "集", label: "Premade decks" };
	if (/^\/decks\/premade\/[^/]+/.test(pathname))
		return { backHref: "/decks/premade", backAriaLabel: "Back to Premade decks" };
	if (/^\/decks\/[^/]+\/preview/.test(pathname))
		return { backHref: "/decks/premade", backAriaLabel: "Back to Premade decks" };
	if (/^\/decks\/[^/]+/.test(pathname))
		return { kanji: "束", label: "Deck", backHref: "/decks", backAriaLabel: "Back to Decks" };

	if (pathname.startsWith("/settings"))
		return { kanji: "設", label: "Settings" };

	if (pathname === "/insights" || pathname === "/insights/overview")
		return { kanji: "観", label: "Overview" };
	if (pathname.startsWith("/insights/statistics"))
		return { kanji: "数", label: "Statistics" };
	if (pathname.startsWith("/insights/forecast"))
		return { kanji: "予", label: "Forecast" };
	if (pathname.startsWith("/insights/progress"))
		return { kanji: "歩", label: "Progress" };

	if (pathname === "/weak-spots")
		return { kanji: "弱", label: "Weak spots" };

	// Immersive sessions (review/session, weak-spots/drill) are covered by
	// SessionOverlay (z-overlay: 50 > z-sticky: 15) — no special config needed.
	return { desktopHidden: true };
}

/**
 * Persistent TopBar rendered once in (app)/layout — never unmounts on
 * navigation. Derives page chrome from the current pathname for static routes;
 * pages with dynamic titles or actions use SetTopBar to push store overrides
 * that take precedence over the route config.
 */
export function AppTopBar(): React.JSX.Element {
	const pathname = usePathname();
	const override = useTopBarStore(s => s.override);

	const route = getRouteConfig(pathname);

	const kanji = override?.kanji ?? route.kanji;
	const label = override?.label ?? route.label;
	const labelLang = override?.labelLang ?? route.labelLang;
	const backHref = override?.backHref ?? route.backHref;
	const backAriaLabel = override?.backAriaLabel ?? route.backAriaLabel;
	const desktopHidden = override?.desktopHidden ?? route.desktopHidden;
	const actions = override?.actions;

	return (
		<TopBar desktopHidden={desktopHidden ?? false}>
			{backHref !== undefined && (
				<TopBarBackLink href={backHref} ariaLabel={backAriaLabel ?? "Back"} />
			)}
			{kanji !== undefined && label !== undefined && (
				<TopBarTitle
					kanji={kanji}
					label={label}
					{...(labelLang !== undefined ? { labelLang } : {})}
				/>
			)}
			{actions}
		</TopBar>
	);
}
