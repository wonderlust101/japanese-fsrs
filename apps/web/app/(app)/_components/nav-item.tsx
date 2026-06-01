"use client";

import type { NavIconKey, NavItemConfig } from "./nav-config";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
	IconBrowse,
	IconCards,
	IconChevronRight,
	IconDecks,
	IconForecast,
	IconOverview,
	IconProgress,
	IconReviews,
	IconStatistics,
	IconWeakSpots,
} from "@/components/icons/chrome-marks";
import { useUnresolvedWeakSpotCount } from "@/lib/api/weak-spots";
import { resolveActiveHref } from "./nav-config";
import { OfflineQueueBadge } from "./offline-queue-badge";

/**
 * Bespoke chrome-marks icon registry for production navigation.
 *
 * The Record<NavIconKey, ...> type stays exhaustive: adding a new key to
 * NavIconKey without adding a component here is a TypeScript error.
 *
 * Icons are static. Color/state inherits from the parent row via
 * `currentColor`; the icon never animates on hover or active.
 */
const NAV_ICON_REGISTRY: Record<NavIconKey, (props: { className?: string }) => React.JSX.Element> = {
	reviews: IconReviews,
	weakSpots: IconWeakSpots,
	decks: IconDecks,
	premade: IconBrowse,
	cards: IconCards,
	overview: IconOverview,
	progress: IconProgress,
	forecast: IconForecast,
	statistics: IconStatistics,
};

interface NavItemProps {
	item: NavItemConfig;
	/**
	 * Called when the user activates the link. The MobileDrawer passes its
	 * `close` action so tapping a nav row closes the drawer before the route
	 * change. Sidebar omits this prop.
	 */
	onNavigate?: () => void;
	/** 0 = top-level item with icon; 1 = sub-nav child (no icon, indented). */
	level?: 0 | 1;
	/**
	 * Icon-only rail rendering at 64px width. Label becomes sr-only; chevron
	 *  and trailing chrome hide. Used by the Sidebar's collapsed state.
	 */
	collapsed?: boolean;
	/**
	 * Optional second line under the main label. Used to lift the Reviews
	 *  row to a soft CTA when due > 0: e.g. "12 cards · ~6 min". Ignored in
	 *  collapsed rail (label is sr-only there).
	 */
	subLabel?: string;
	/**
	 * External override for active state. When provided, takes precedence
	 *  over the locally-computed pathname match. Used by parent rows with
	 *  prefix-sharing siblings (e.g. `/decks` and `/cards`) so only
	 *  the longest matching child renders as active.
	 */
	forceActive?: boolean;
	/**
	 * Trailing count chip rendered after the label for the Insights → WeakSpots
	 * row. When `count === 0`, no chip renders; when `count > 0`, the chip
	 * displays the integer (or `50+` when `hasMore` is true). Always hidden
	 * in the collapsed rail since the rail shows icons only.
	 */
	weakSpotBadge?: { count: number; hasMore: boolean };
}

/**
 * Map of `?from=<section>` query values to the nav href that should be
 * forced active. Lets a sub-page (e.g. card detail) be reached from
 * multiple parent sections and have the sidebar highlight whichever
 * section the user came from, instead of the canonical section the
 * URL path otherwise implies.
 */
const FROM_OVERRIDE_HREF: Record<string, string> = {
	decks: "/decks",
};

/**
 * Resolves whether the current location should hijack active state and
 * route it to a different nav href. Returns the override href, or
 * `null` if normal pathname-based matching applies.
 *
 * The hijack triggers when the user is on a card-detail page
 * (`/cards/[id]`) AND the URL carries a `?from=<section>` query that
 * matches the FROM_OVERRIDE_HREF map.
 */
function resolveOverrideHref(pathname: string, from: string | null): string | null {
	if (!pathname.startsWith("/cards/"))
		return null;
	if (from === null)
		return null;
	return FROM_OVERRIDE_HREF[from] ?? null;
}

function NOOP(): void {}

/**
 * The nav-row primitive shared by Sidebar and MobileDrawer.
 *
 * Active state anatomy (route-change settle, four beats):
 *   1. 2px Inari Vermillion top stripe draws in left-to-right (200ms).
 *   2. Vermillion Wash row background fades in (250ms, 50ms delay).
 *   3. Icon paths draw on (300ms, 150ms delay, per-path stagger via :nth-of-type).
 *   4. Label color crossfades sumi-ink → inari-vermillion (200ms, 200ms delay).
 *
 * Reduced motion: `prefers-reduced-motion` already maps every animation
 * and transition to 0.01ms in `globals.css`. The end-state visual is
 * preserved because the static CSS rules always match.
 */
export function NavItem({
	item,
	onNavigate = NOOP,
	level = 0,
	collapsed = false,
	subLabel,
	forceActive,
	weakSpotBadge,
}: NavItemProps): React.JSX.Element {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const Icon = NAV_ICON_REGISTRY[item.iconKey];
	const children = item.children ?? [];
	const hasChildren = children.length > 0;

	// The one nav href that should render active for this location. A `?from=`
	// override (see `resolveOverrideHref`) wins when present; otherwise the
	// longest-prefix match against the nav config decides, so a detail route
	// lights up its section (e.g. `/decks/<id>` → `/decks`). Computed once per
	// render and compared by equality below.
	const overrideHref = resolveOverrideHref(pathname, searchParams.get("from"));
	const activeHref = overrideHref ?? resolveActiveHref(pathname);

	const matchHref = (href: string): boolean => href === activeHref;

	const childMatches = hasChildren && children.some(c => matchHref(c.href));
	// Parent stays *inactive* when a child is active so we never show two active
	// states for one location.
	const matches = matchHref(item.href);
	const isActive = forceActive ?? (matches && !childMatches);

	// Among children with prefix-sharing hrefs (e.g. `/decks` vs `/cards`),
	// only the longest matching href should render active. Computing it here
	// (where sibling context is available) and forwarding via `forceActive` is
	// the only place we can resolve the ambiguity — each child NavItem on its
	// own sees only its own href and can't tell that a more-specific sibling
	// is the better match.
	const activeChildHref = hasChildren
		? children
				.filter(c => matchHref(c.href))
				.reduce<string | null>(
					(best, c) => (best === null || c.href.length > best.length ? c.href : best),
					null,
				)
		: null;

	// First-entry-only auto-expand: when the user enters a child route for the
	// first time this session, the section opens once so they can see where
	// they are. After that, the user's manual collapse choice is respected.
	// hasAutoExpandedRef ref tracks the one-time event.
	const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
	const hasAutoExpandedRef = useRef(false);

	useEffect(() => {
		if (!hasChildren)
			return;
		if (childMatches && !hasAutoExpandedRef.current) {
			setManualExpanded(true);
			hasAutoExpandedRef.current = true;
		}
	}, [childMatches, hasChildren]);

	// Reset manual override when the route changes externally so dropdowns
	// close when the user opens another link, regardless of section.
	useEffect(() => {
		if (!childMatches)
			setManualExpanded(null); // eslint-disable-line react/set-state-in-effect -- resets the manual expand override when the route changes externally
	}, [pathname, childMatches]);

	const isExpanded = manualExpanded ?? childMatches;

	// --- Collapsed rail rendering: icon-only leaf row ----------------------
	if (collapsed && level === 0) {
		const containerActive = isActive || childMatches;
		return (
			<li>
				<Link
					href={item.href}
					onClick={onNavigate}
					aria-current={isActive ? "page" : undefined}
					data-active={containerActive ? "true" : undefined}
					title={item.label}
					className={[
						"nav-row group relative overflow-hidden rounded-xs",
						"flex items-center justify-center",
						"min-h-11 w-12 mx-auto",
						"text-sumi-ink transition-colors duration-200",
						"hover:bg-cream-inset",
						"data-[active=true]:bg-vermillion-wash",
						"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					].join(" ")}
				>
					<span
						aria-hidden="true"
						className="absolute top-0 inset-x-0 h-0.5 bg-inari-vermillion origin-left scale-x-0 transition-transform duration-200 group-data-[active=true]:scale-x-100 pointer-events-none"
					/>
					<Icon
						className="
              relative z-[1] shrink-0 w-7 h-7
              text-faded-sumi transition-colors duration-200
              group-hover:text-sumi-ink
              group-data-[active=true]:text-inari-vermillion
            "
					/>
					<span className="sr-only">{item.label}</span>
					{item.hasOfflineBadge === true && <OfflineQueueBadge floating />}
				</Link>
			</li>
		);
	}

	// --- Expanded rendering: leaf or parent ------------------------------------
	const linkBase = [
		"nav-row group relative overflow-hidden",
		"flex items-center gap-2",
		"min-h-11",
		"rounded-xs",
		"text-base font-medium text-sumi-ink",
		"transition-colors duration-200 delay-[50ms]",
		"hover:bg-cream-inset",
		"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
		"data-[active=true]:bg-vermillion-wash",
		"data-[active=true]:text-inari-vermillion",
		"data-[active=true]:font-semibold",
		"data-[active=true]:animate-nav-row-wash-in",
		"flex-1 min-w-0",
	].join(" ");

	const linkPad = level === 0 ? "px-3 py-2" : "pl-12 pr-3 py-1.5";

	// Parent rows (those with children) are not links — they are disclosure
	// buttons. The whole row toggles the dropdown; the chevron lives inside the
	// same button as a decorative affordance. This keeps the row to a single
	// tab stop and lets `aria-expanded` apply to the entire visible target.
	if (hasChildren) {
		const toggle = (): void =>
			setManualExpanded(prev => (prev === null ? !childMatches : !prev));

		return (
			<li>
				<button
					type="button"
					onClick={toggle}
					aria-expanded={isExpanded}
					aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
					className={`${linkBase} ${linkPad} w-full text-left appearance-none bg-transparent`}
				>
					<span
						aria-hidden="true"
						className="
              absolute top-0 inset-x-0 h-0.5
              bg-inari-vermillion origin-left
              scale-x-0 transition-transform duration-200
              group-data-[active=true]:scale-x-100
              group-data-[active=true]:animate-nav-stripe-draw
              pointer-events-none
            "
					/>

					{level === 0 && (
						<Icon
							className="
                relative z-[1] shrink-0 w-6 h-6
                text-faded-sumi
                transition-colors duration-200
                group-hover:text-sumi-ink
                group-data-[active=true]:text-inari-vermillion
              "
						/>
					)}

					<span className="relative z-[1] truncate flex-1 group-data-[active=true]:animate-nav-label-fade-in">
						{item.label}
					</span>

					<IconChevronRight
						aria-hidden="true"
						className={`relative z-[1] shrink-0 w-4 h-4 text-faded-sumi transition-transform duration-200 ease-out group-hover:text-sumi-ink ${
							isExpanded ? "rotate-90" : ""
						}`}
					/>
				</button>

				<div
					inert={!isExpanded}
					className={`grid transition-[grid-template-rows] duration-[250ms] ease-out ${
						isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
					}`}
				>
					<ul className="overflow-hidden min-h-0 pt-1.5 flex flex-col gap-y-0.5">
						{children.map((child) => {
							const Renderer = child.hasWeakSpotCount === true ? WeakSpotCountNavItem : NavItem;
							return (
								<Renderer
									key={child.href}
									item={child}
									onNavigate={onNavigate}
									level={1}
									forceActive={child.href === activeChildHref}
								/>
							);
						})}
					</ul>
				</div>
			</li>
		);
	}

	// Trailing count chip (Insights → WeakSpots). Rendered only on leaf rows in
	// expanded chrome; the rail variant short-circuits earlier. Always derive
	// the display string from the live count, capping at the request limit
	// with a `+` overflow when the server signals more pages.
	const weakSpotBadgeDisplay
		= weakSpotBadge !== undefined && weakSpotBadge.count > 0
			? (weakSpotBadge.hasMore ? `${weakSpotBadge.count}+` : String(weakSpotBadge.count))
			: null;

	// Augment the row's accessible name so screen readers announce the count
	// as part of the row label, not as a separately-focused element.
	const rowAriaLabel
		= weakSpotBadgeDisplay !== null
			? `${item.label}, ${weakSpotBadge?.count ?? 0} unresolved`
			: undefined;

	return (
		<li>
			<Link
				href={item.href}
				onClick={onNavigate}
				aria-current={isActive ? "page" : undefined}
				{...(rowAriaLabel !== undefined && { "aria-label": rowAriaLabel })}
				data-active={isActive ? "true" : undefined}
				className={`${linkBase} ${linkPad}`}
			>
				{/* 2px Inari Vermillion top stripe: brand identity device extended
            into chrome. Always rendered so the leave transition plays
            cleanly when navigating away. */}
				<span
					aria-hidden="true"
					className="
            absolute top-0 inset-x-0 h-0.5
            bg-inari-vermillion origin-left
            scale-x-0 transition-transform duration-200
            group-data-[active=true]:scale-x-100
            group-data-[active=true]:animate-nav-stripe-draw
            pointer-events-none
          "
				/>

				{/* Icon: only rendered at level 0. */}
				{level === 0 && (
					<Icon
						className="
              relative z-[1] shrink-0 w-6 h-6
              text-faded-sumi
              transition-colors duration-200
              group-hover:text-sumi-ink
              group-data-[active=true]:text-inari-vermillion
            "
					/>
				)}

				{/* Label + optional subLabel stacked when subLabel is present. */}
				{subLabel === undefined
					? (
							<span className="relative z-[1] truncate group-data-[active=true]:animate-nav-label-fade-in">
								{item.label}
							</span>
						)
					: (
							<span className="relative z-[1] flex flex-col min-w-0">
								<span className="truncate leading-tight group-data-[active=true]:animate-nav-label-fade-in">
									{item.label}
								</span>
								<span className="truncate text-xs text-faded-sumi leading-tight font-normal mt-0.5">
									{subLabel}
								</span>
							</span>
						)}

				{weakSpotBadgeDisplay !== null && (
					<span
						aria-hidden="true"
						className={[
							"relative z-[1] ml-auto shrink-0 inline-flex items-center justify-center",
							"min-w-[1.25rem] px-1.5 py-px",
							"rounded-xs border border-inari-vermillion/35 bg-warm-paper-raised",
							"font-mono text-sm tabular-nums leading-none",
							"text-inari-vermillion-deep",
							// When the row is active, the row background shifts to
							// vermillion-wash; the chip's paper-raised background then
							// pops cleanly against it without a tone swap.
						].join(" ")}
					>
						{weakSpotBadgeDisplay}
					</span>
				)}

				{item.hasOfflineBadge === true && <OfflineQueueBadge />}
			</Link>
		</li>
	);
}

/**
 * Wrapper that subscribes to the unresolved-weakSpot count and forwards the
 * resolved badge data into `NavItem`. Used only when an item config has
 * `hasWeakSpotCount: true`, so the TanStack Query subscription is local to
 * the weakSpot row and never fires for nav rows that don't need it.
 *
 * Exported so both `Sidebar` and `MobileDrawer` can dispatch to it for
 * top-level weak-spots rows (the recursive child render below uses the
 * same wrapper for the parent-with-children code path).
 */
export function WeakSpotCountNavItem(props: NavItemProps): React.JSX.Element {
	const { count, hasMore } = useUnresolvedWeakSpotCount();
	return <NavItem {...props} weakSpotBadge={{ count, hasMore }} />;
}
