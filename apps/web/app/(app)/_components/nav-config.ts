/**
 * Single source of truth for the navigation structure shared by the desktop
 * Sidebar and the MobileDrawer. Adding a top-level surface or a sub-nav
 * child here updates both chrome surfaces simultaneously.
 *
 * Section ordering follows the morning-ritual flow: Study (what you do
 * with cards today), Library (what you study), Insights (what you've done).
 *
 * The config holds only serializable data (strings, primitives). Icon
 * components are resolved client-side via the registry in nav-item.tsx,
 * looked up by `iconKey`. This keeps the config file safe to import from
 * Server Components without breaking the server-to-client serialization
 * boundary that React Server Components enforces around function refs.
 */

export type NavIconKey
	= | "reviews"
		| "weakSpots"
		| "decks"
		| "premade"
		| "cards"
		| "overview"
		| "progress"
		| "forecast"
		| "statistics";

export interface NavItemConfig {
	href: string;
	iconKey: NavIconKey;
	label: string;
	hasOfflineBadge?: boolean;
	hasDueCount?: boolean;
	/**
	 * Sidebar and drawer should attach a small unresolved-weakSpot count chip to
	 * the row label. The static flag lives here; live data is wired by the
	 * rendering shell (`sidebar.tsx` / `mobile-drawer.tsx`), keeping this
	 * config serializable across the RSC boundary.
	 */
	hasWeakSpotCount?: boolean;
	children?: NavItemConfig[];
}

export interface NavSectionConfig {
	label: string;
	/**
	 * Section identity kanji shown next to the label in expanded chrome and
	 *  alone (with tooltip) in the 64px collapsed rail.
	 */
	kanji: string;
	items: NavItemConfig[];
}

/**
 * Flattens the section tree (depth-first, parents before children) into the
 * full list of nav hrefs. Used to resolve longest-prefix active state in
 * `resolveActiveHref`.
 */
function collectHrefs(items: NavItemConfig[]): string[] {
	const out: string[] = [];
	for (const item of items) {
		out.push(item.href);
		if (item.children !== undefined)
			out.push(...collectHrefs(item.children));
	}
	return out;
}

export const NAV_SECTIONS: NavSectionConfig[] = [
	{
		label: "Study",
		kanji: "練",
		items: [
			{ href: "/today", iconKey: "reviews", label: "Reviews", hasDueCount: true },
			{ href: "/weak-spots", iconKey: "weakSpots", label: "Weak spots", hasWeakSpotCount: true },
		],
	},
	{
		label: "Library",
		kanji: "書",
		items: [
			{ href: "/decks", iconKey: "decks", label: "Decks" },
			{ href: "/decks/premade", iconKey: "premade", label: "Premade decks" },
			{ href: "/cards", iconKey: "cards", label: "Cards" },
		],
	},
	{
		label: "Insights",
		kanji: "析",
		items: [
			{ href: "/insights", iconKey: "overview", label: "Overview" },
			{ href: "/insights/progress", iconKey: "progress", label: "Progress" },
			{ href: "/insights/forecast", iconKey: "forecast", label: "Forecast" },
			{ href: "/insights/statistics", iconKey: "statistics", label: "Statistics" },
		],
	},
];

/**
 * Every nav href, flattened from the section tree. Sourced from the same
 * config the chrome renders, so active-state resolution can never drift from
 * the visible rows.
 */
const ALL_NAV_HREFS: readonly string[] = NAV_SECTIONS.flatMap(s => collectHrefs(s.items));

/**
 * The single nav href that best represents `pathname`: the longest href that
 * is either equal to the pathname or one of its path-segment prefixes.
 *
 * Longest-prefix matching is what nav highlighting actually wants. A detail
 * route lights up its section (`/decks/<id>` → `/decks`), while a more-
 * specific sibling still wins whenever the user is beneath it (`/decks/premade`
 * and everything under it → `/decks/premade`, never `/decks`). The earlier
 * exact-match rule couldn't express this: it forced `/decks` to exact-only
 * because `/decks/premade` shares its prefix, which left deck-detail pages
 * with no active row.
 *
 * Returns `null` for routes with no nav representation (e.g. the full-screen
 * review flow), so no row lights up there.
 */
export function resolveActiveHref(pathname: string): string | null {
	let best: string | null = null;
	for (const href of ALL_NAV_HREFS) {
		if (pathname === href || pathname.startsWith(`${href}/`)) {
			if (best === null || href.length > best.length)
				best = href;
		}
	}
	return best;
}
