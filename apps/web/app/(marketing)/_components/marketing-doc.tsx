"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { SectionKicker } from "@/components/ui/SectionKicker";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Mirrors the landing's calligraphic "weighted exhale" curve (globals.css
// --ease-out-expo) so doc pages settle with the same cadence as the home page.
const EXPO_OUT = "expo.out";

export interface TocEntry {
	id: string;
	label: string;
}

interface DocShellProps {
	kicker: string;
	title: string;
	lede?: string;
	/** Mono metadata line under the lede, e.g. "Last updated May 24, 2026". */
	meta?: string;
	/** Decorative full-bleed kanji ghosted into the header band. aria-hidden. */
	kanji: string;
	/** Header watermark tone. Legal pages read more serious in ink; help is warmer. */
	kanjiTone?: "ink" | "vermillion";
	/** Optional sticky table of contents (rendered on lg+ only). */
	toc?: readonly TocEntry[];
	children: React.ReactNode;
}

/**
 * The shared chrome for the marketing doc pages (Help, Privacy, Terms). It
 * carries the home page's visual language down into long-form content: a
 * full-bleed header band with a ghosted kanji watermark bleeding off the edge,
 * Bricolage display type, a mono kicker, and a restrained GSAP entrance plus
 * scroll-reveals. All motion is gated behind `prefers-reduced-motion:
 * no-preference`; the SSR markup is the reduced-motion experience.
 *
 * Server pages render this client component and pass their server-rendered
 * content as `children`, so page `metadata` and JSON-LD stay server-side.
 */
export function DocShell({
	kicker,
	title,
	lede,
	meta,
	kanji,
	kanjiTone = "ink",
	toc,
	children,
}: DocShellProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const intro = gsap.timeline({ defaults: { ease: EXPO_OUT } });
				intro
					.from("[data-doc-kanji]", { autoAlpha: 0, scale: 1.06, duration: 1.5 }, 0)
					.from("[data-doc-head] > *", { autoAlpha: 0, y: 18, duration: 0.9, stagger: 0.08 }, 0.1);

				// `opacity` (not `autoAlpha`) on purpose: autoAlpha toggles
				// `visibility: hidden`, which drops not-yet-revealed content out of the
				// accessibility tree and out of find-in-page. Opacity keeps the text
				// findable and screen-reader-readable while it fades in.
				gsap.utils.toArray<HTMLElement>("[data-doc-reveal]").forEach((el) => {
					gsap.from(el, {
						opacity: 0,
						y: 24,
						duration: 0.9,
						ease: EXPO_OUT,
						scrollTrigger: { trigger: el, start: "top 86%", once: true },
					});
				});
			});
			return () => mm.revert();
		},
		{ scope: rootRef },
	);

	return (
		<div ref={rootRef}>
			{/* Header band — the home hero's quieter cousin: full-bleed tint, ghosted
          kanji bleeding off the right, display title, mono kicker. */}
			<header className="relative overflow-hidden border-b border-soft-hairline bg-warm-paper-base">
				<span
					data-doc-kanji
					aria-hidden="true"
					lang="ja"
					className={cn(
						"pointer-events-none absolute right-[-6%] top-1/2 z-0 -translate-y-1/2 select-none font-japanese leading-none",
						"text-[38vw] md:text-[18rem]",
						kanjiTone === "vermillion" ? "text-inari-vermillion/[0.07]" : "text-sumi-ink/[0.045]",
					)}
				>
					{kanji}
				</span>

				<div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-8 md:py-20 lg:px-12">
					<div data-doc-head className="flex max-w-measure-wide flex-col gap-4">
						<SectionKicker>{kicker}</SectionKicker>
						<h1 className="max-w-[18ch] font-display text-4xl font-semibold leading-[1.03] tracking-[-0.02em] text-sumi-ink md:text-5xl">
							{title}
						</h1>
						{lede !== undefined && (
							<p className="max-w-measure text-base leading-[1.6] text-faded-sumi md:text-md">{lede}</p>
						)}
						{meta !== undefined && (
							<p className="font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">{meta}</p>
						)}
					</div>
				</div>
			</header>

			{/* Body. With a TOC the content runs in a two-column measure on lg+, the
          nav sticky beside it; without one it stays a single reading column. */}
			<div className="mx-auto w-full max-w-[1440px] px-6 py-12 sm:px-8 md:py-16 lg:px-12">
				{toc !== undefined ? (
					<div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-20">
						<aside className="hidden lg:block">
							<nav aria-label="On this page" className="sticky top-24 flex flex-col">
								{/* A label, not a link: darker ink tone + a hairline divider set
                    it apart from the lighter, interactive entries below. */}
								<SectionKicker tone="ink" className="mb-4 border-b border-soft-hairline pb-3">
									On this page
								</SectionKicker>
								<div className="flex flex-col gap-2.5">
									{toc.map(entry => (
										<a
											key={entry.id}
											href={`#${entry.id}`}
											className="rounded-xs text-sm leading-snug text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
										>
											{entry.label}
										</a>
									))}
								</div>
							</nav>
						</aside>
						<div className="min-w-0">{children}</div>
					</div>
				) : (
					children
				)}
			</div>
		</div>
	);
}

/**
 * A block that fades and lifts into view once on scroll-in. Marks itself with
 * `data-doc-reveal` so the parent `DocShell` orchestrates it. Renders a plain
 * div so it nests cleanly around any server-rendered content.
 */
export function DocReveal({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}): React.JSX.Element {
	return (
		<div data-doc-reveal className={className}>
			{children}
		</div>
	);
}
