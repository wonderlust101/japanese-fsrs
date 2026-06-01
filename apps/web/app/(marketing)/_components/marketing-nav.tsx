"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

// Section anchors live on the landing page. Prefixing with `/` means the links
// also work from /help, /privacy, /terms (navigate home, then scroll to the
// section), not just from the home page itself.
// Labels match the section each anchor lands on. The landing's middle is one
// pinned "continuous take" (the #features and #method beats share the same
// pinned stage, so they resolve to the same scroll position); we surface the
// two anchors that land somewhere distinct: the feature tour (#features) and
// the premade-decks band (#coverage).
const SECTION_LINKS = [
	{ href: "/#features", label: "Features" },
	{ href: "/#coverage", label: "Decks" },
] as const;

// Shared nav-link styling: a ≥44px tap target (min-h + centered) so touch users
// get a comfortable WCAG-2.5.5 hit area, not just the text's line box. The
// `display` utility is intentionally NOT included here, each call site sets its
// own (`inline-flex`, or `hidden md:inline-flex`), so a baked-in `inline-flex`
// can never override a `hidden` on a responsive-hidden link.
const NAV_LINK
	= "min-h-[44px] items-center rounded-xs text-sm font-medium text-faded-sumi transition-colors hover:text-sumi-ink "
		+ "focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2";

/**
 * Full-width marketing navbar. A solid warm-paper bar with a hairline border at
 * all scroll positions (a transparent float over the hero let the brand mark
 * overlap the headline). On small screens the section anchors and Sign in fold
 * into an accessible disclosure menu (they cannot fit the bar).
 *
 * A vermillion ink rail along the bottom edge tracks reading progress through
 * the page. It is driven imperatively (a `scaleX` transform written to a ref),
 * so per-frame scroll updates never re-render React. `scrolled` gates the rail's
 * fade-in (it appears once the hero has scrolled past); `menuOpen` is the only
 * other UI state that flows through render.
 */
export function MarketingNav(): React.JSX.Element {
	const [scrolled, setScrolled] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const railRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		let frame = 0;
		// `scrolled` flips true the instant the hero's bottom edge passes under the
		// 4rem bar; it gates the reading-progress rail's fade-in (the bar itself is
		// always solid now). Pages without a hero (help / privacy / terms) have no
		// `[data-hero]` element, so they read as scrolled from the first frame.
		const NAV_H = 64;
		const onScroll = (): void => {
			if (frame !== 0)
				return;
			frame = window.requestAnimationFrame(() => {
				const y = window.scrollY;
				const hero = document.querySelector("[data-hero=\"section\"]");
				const solid = hero ? hero.getBoundingClientRect().bottom <= NAV_H : true;
				setScrolled(solid);
				// Document reading progress, 0..1, written straight to the rail.
				const max = document.documentElement.scrollHeight - window.innerHeight;
				const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
				if (railRef.current)
					railRef.current.style.transform = `scaleX(${progress})`;
				frame = 0;
			});
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frame !== 0)
				window.cancelAnimationFrame(frame);
		};
	}, []);

	// Escape closes the mobile menu (only bound while it is open).
	useEffect(() => {
		if (!menuOpen)
			return;
		const onKey = (e: KeyboardEvent): void => {
			if (e.key === "Escape")
				setMenuOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [menuOpen]);

	return (
		<header
			className={cn(
				// Pinned above the whole z-ladder so the GSAP-pinned (position: fixed)
				// sections and z-10 content below can never paint over it. `--z-nav`
				// (40) sits above sticky/raised/bar and the page's local z-10 layers,
				// below toasts. Always a solid warm-paper bar with a hairline + card
				// shadow: a transparent float let the brand mark overlap the hero
				// headline, so the bar stays opaque over the fold too.
				"fixed inset-x-0 top-0 z-[var(--z-nav)] border-b border-soft-hairline bg-warm-paper-base shadow-card",
			)}
		>
			{/* Gutters mirror the hero's inner container (px-6 sm:px-10 lg:px-16) so the
          brand mark shares a left edge with the headline and the CTA aligns with
          the hero's right edge — the bar reads as the same measure as the fold. */}
			<div className="flex h-16 w-full items-center justify-between px-6 sm:px-10 lg:px-16">
				<Link
					href="/"
					aria-label="Tomo — home"
					className="inline-flex min-h-[44px] items-center rounded-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
				>
					<Logo size={36} wordmarkSize="md" priority />
				</Link>

				<nav aria-label="Primary" className="flex items-center gap-2 sm:gap-6">
					<ul className="hidden items-center gap-6 md:flex">
						{SECTION_LINKS.map(link => (
							<li key={link.href}>
								<Link href={link.href} className={cn("inline-flex", NAV_LINK)}>
									{link.label}
								</Link>
							</li>
						))}
					</ul>
					<Link href="/login" className={cn("hidden md:inline-flex", NAV_LINK)}>
						Sign in
					</Link>
					<ButtonLink href="/signup" size="md" className="min-h-[44px]">
						Start practicing
					</ButtonLink>

					{/* Mobile disclosure: reveals the section anchors + Sign in, which do
              not fit the bar on small screens. */}
					<button
						type="button"
						aria-label={menuOpen ? "Close menu" : "Open menu"}
						aria-expanded={menuOpen}
						aria-controls="mobile-menu"
						onClick={() => setMenuOpen(open => !open)}
						className="inline-flex size-11 items-center justify-center rounded-xs text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 md:hidden"
					>
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
							{menuOpen
								? (
										<path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
									)
								: (
										<path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
									)}
						</svg>
					</button>
				</nav>
			</div>

			{/* Mobile menu panel — only rendered when open, only shown below md. */}
			{menuOpen && (
				<div id="mobile-menu" className="border-t border-soft-hairline bg-warm-paper-base md:hidden">
					<ul className="flex flex-col px-6 py-2 sm:px-10">
						{SECTION_LINKS.map(link => (
							<li key={link.href} className="border-b border-soft-hairline/60 last:border-b-0">
								<Link href={link.href} onClick={() => setMenuOpen(false)} className={cn("inline-flex w-full", NAV_LINK)}>
									{link.label}
								</Link>
							</li>
						))}
						<li>
							<Link href="/login" onClick={() => setMenuOpen(false)} className={cn("inline-flex w-full", NAV_LINK)}>
								Sign in
							</Link>
						</li>
					</ul>
				</div>
			)}

			{/* Reading-progress ink rail. Anchored to the header's bottom edge, it
          fills left→right as the page is read. `origin-left scaleX` keeps the
          paint on the compositor; opacity holds it quiet until the bar settles. */}
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-inari-vermillion transition-opacity duration-300",
					scrolled ? "opacity-100" : "opacity-0",
				)}
				ref={railRef}
				style={{ transform: "scaleX(0)" }}
			/>
		</header>
	);
}
