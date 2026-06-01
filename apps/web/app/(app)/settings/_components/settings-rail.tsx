"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { SETTINGS_SECTIONS } from "./settings-sections";

/**
 * Horizontal tab bar for /settings/* — one component, every breakpoint.
 *
 * Sits sticky beneath the TopBar and stretches the full 1440px canvas.
 * Each tab is a kanji + label pair with a 2px Inari Vermillion underline
 * on the active route. The hairline on the nav's bottom edge runs the
 * whole viewport so the strip reads as a deliberate header rule, not a
 * floating pill cluster.
 *
 * Auto-scrolls the active tab into horizontal center on route change so
 * the current section never sits off-screen if the row overflows (which
 * it only does at very narrow widths or after future label growth).
 *
 * File name kept as `settings-rail.tsx` for now — it's the settings
 * navigation primitive; the visual form is "tab bar". Renaming the file
 * is a separate, churn-y move.
 */

function activeSectionFromPathname(pathname: string): string | null {
	const segments = pathname.split("/").filter(s => s.length > 0);
	if (segments[0] !== "settings")
		return null;
	return segments[1] ?? null;
}

export function SettingsTabBar(): React.JSX.Element {
	const pathname = usePathname();
	const activeId = activeSectionFromPathname(pathname);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null || activeId === null)
			return;
		const activeTab = container.querySelector<HTMLAnchorElement>(
			`[data-section-id="${activeId}"]`,
		);
		if (activeTab === null)
			return;

		const tabRect = activeTab.getBoundingClientRect();
		const containerRect = container.getBoundingClientRect();
		const offsetCenter
			= (tabRect.left + tabRect.width / 2)
				- (containerRect.left + containerRect.width / 2);
		container.scrollBy({ left: offsetCenter, behavior: "smooth" });
	}, [activeId]);

	return (
		<nav
			aria-label="Settings sections"
			className="sticky top-0 z-[var(--z-sticky)] border-b border-soft-hairline bg-cool-paper-base"
		>
			<div
				ref={containerRef}
				className={[
					"mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 md:px-12 lg:px-16",
					"[scrollbar-width:none] [-ms-overflow-style:none]",
					"[&::-webkit-scrollbar]:hidden",
				].join(" ")}
			>
				{SETTINGS_SECTIONS.map((section) => {
					const active = section.id === activeId;
					return (
						<Link
							key={section.id}
							href={`/settings/${section.id}`}
							data-section-id={section.id}
							aria-current={active ? "page" : undefined}
							className={[
								"group relative inline-flex shrink-0 items-baseline gap-2",
								"px-3 py-3.5 text-sm font-medium ui-motion-colors sm:px-4",
								active ? "text-sumi-ink" : "text-faded-sumi hover:text-sumi-ink",
							].join(" ")}
						>
							<span
								lang="ja"
								aria-hidden="true"
								className={[
									"select-none font-display text-base leading-none ui-motion-colors",
									active
										? "text-inari-vermillion"
										: "text-faded-sumi/85 group-hover:text-faded-sumi",
								].join(" ")}
							>
								{section.kanji}
							</span>
							<span>{section.label}</span>
							<span
								aria-hidden="true"
								className={[
									"absolute inset-x-3 -bottom-px h-0.5 transition-colors duration-200 ease-out sm:inset-x-4",
									active ? "bg-inari-vermillion" : "bg-transparent",
								].join(" ")}
							/>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
