"use client";

import type { StatisticsSection as SectionMeta } from "./sections";

import { KanjiLabel } from "@/components/ui/KanjiLabel";
import { useSectionCollapse } from "./section-collapse";

interface StatisticsSectionProps {
	section: SectionMeta;
	children: React.ReactNode;
	/** Optional right slot for a per-section control (e.g. time range tabs). */
	rightSlot?: React.ReactNode;
	/**
	 * Opt-in page-level reveal participation. When `true`, emits `data-reveal` on
	 * this section's outer `<section>` so the statistics `useRevealScroll`
	 * cascade staggers the FIVE stat sections in (rather than the 10+ inner
	 * SectionCards — that would over-animate). Default `false`.
	 */
	reveal?: boolean;
}

/**
 * One Statistics-page section. The header is a collapse toggle (kanji + label
 * + the teacher question) followed by the section body. The anchor id matches
 * `section.id`, which the sticky tab bar's IntersectionObserver targets; the
 * body id is what the toggle's aria-controls points at. Sections start
 * expanded and remember per-learner collapses (see section-collapse).
 */
export function StatisticsSection({
	section,
	children,
	rightSlot,
	reveal = false,
}: StatisticsSectionProps): React.JSX.Element {
	const ariaId = `${section.id}-heading`;
	const panelId = `${section.id}-panel`;
	const { collapsed, toggle } = useSectionCollapse(section.id);

	return (
		<section
			id={section.id}
			aria-labelledby={ariaId}
			className="scroll-mt-32"
			{...(reveal && { "data-reveal": "" })}
		>
			<header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-soft-hairline pb-4 lg:mb-8 lg:pb-5">
				<div className="flex flex-col gap-y-1">
					<button
						type="button"
						onClick={toggle}
						aria-expanded={!collapsed}
						aria-controls={panelId}
						className="group -mx-1 flex items-center gap-x-3 rounded-xs px-1 py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
					>
						<Chevron collapsed={collapsed} />
						<h2 id={ariaId} className="flex min-w-0 items-baseline gap-x-3">
							<KanjiLabel kanji={section.kanji} label={section.label} />
						</h2>
					</button>
					<p className="max-w-measure pl-[1.625rem] text-sm leading-[1.55] text-faded-sumi">
						{section.question}
					</p>
				</div>
				{rightSlot !== undefined && !collapsed && (
					<div className="shrink-0">{rightSlot}</div>
				)}
			</header>
			<div id={panelId} hidden={collapsed}>{children}</div>
		</section>
	);
}

/** Disclosure chevron: points down when expanded, right when collapsed. */
function Chevron({ collapsed }: { collapsed: boolean }): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 16 16"
			className={[
				"h-3.5 w-3.5 shrink-0 text-faded-sumi motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out group-hover:text-sumi-ink",
				collapsed ? "-rotate-90" : "rotate-0",
			].join(" ")}
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M4 6l4 4 4-4" />
		</svg>
	);
}
