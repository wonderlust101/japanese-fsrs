"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { IconClose } from "@/components/icons/chrome-marks";

import { Logo } from "@/components/ui/Logo";
import { DUR, EASE } from "@/lib/motion/easings";
import { gsap, useGSAP } from "@/lib/motion/register";
import { useMobileNavStore } from "@/stores/useMobileNavStore";

import { AddCardCta } from "./add-card-cta";
import { NAV_SECTIONS } from "./nav-config";
import { NavItem, WeakSpotCountNavItem } from "./nav-item";
import { NavSection } from "./nav-section";
import { useReviewsSubLabel } from "./use-reviews-sub-label";
import { UserMenu } from "./user-menu";

interface Props {
	user: User | null;
}

/**
 * Mobile chrome (< lg breakpoint). Slide-in drawer from the left with the
 * V5.1 design: brand strip + bilingual today strip + kanji-led nav sections
 * + Help row (mobile variant) + UserMenu.
 *
 * Triggered by the hamburger in TopBar; closed by tapping the backdrop, the
 * close button, the Escape key, or any nav row (which closes before the
 * route change).
 */
export function MobileDrawer({ user }: Props): React.JSX.Element {
	const isOpen = useMobileNavStore(s => s.isOpen);
	const close = useMobileNavStore(s => s.close);
	const drawerRef = useRef<HTMLDivElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	// Body scroll lock while open.
	useEffect(() => {
		if (!isOpen)
			return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [isOpen]);

	// Focus trap, escape-to-close, focus first interactive on open.
	useEffect(() => {
		if (!isOpen)
			return;
		const drawer = drawerRef.current;
		if (drawer === null)
			return;

		const focusable = (): HTMLElement[] =>
			Array.from(
				drawer.querySelectorAll<HTMLElement>(
					"button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])",
				),
			);

		// Land initial focus on the close button rather than the first focusable
		// element. The first focusable is the brand link (which navigates to
		// /today on Enter); auto-focusing it means a user who opens the drawer
		// intending to browse navigation could accidentally route away with a
		// single Enter keystroke. The close button is the safe default.
		if (closeButtonRef.current !== null) {
			closeButtonRef.current.focus();
		} else {
			focusable()[0]?.focus();
		}

		function handleKeyDown(e: KeyboardEvent): void {
			if (e.key === "Escape") {
				e.preventDefault();
				close();
				return;
			}
			if (e.key !== "Tab")
				return;
			const ring = focusable();
			const first = ring[0];
			const last = ring[ring.length - 1];
			if (first === undefined || last === undefined)
				return;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, close]);

	// Drawer open/close motion (per docs/motion/DASHBOARD_MOTION_SPEC.md §2.10).
	// The panel x-slides (transform only — it stays visible and in the a11y tree
	// so the nav inside is focusable as it slides; never autoAlpha the panel) and
	// the backdrop fades (autoAlpha — decorative). Gated `< lg` (the drawer is
	// `lg:hidden`) and behind `prefers-reduced-motion: no-preference`. The CSS
	// `translate-x`/`opacity` classes remain as the instant reduced-motion / no-JS
	// baseline; this effect overrides them with an animated transition and clears
	// its inline props on cleanup so the class state takes back over. Sidebar and
	// nav-item internals are deliberately untouched (forbidden / tuned CSS).
	useGSAP(
		() => {
			const panel = drawerRef.current;
			const backdrop = backdropRef.current;
			if (panel === null || backdrop === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference) and (max-width: 1023px)", () => {
				if (isOpen) {
					const tl = gsap.timeline({ defaults: { ease: EASE.out } });
					tl.fromTo(panel, { xPercent: -100 }, { xPercent: 0, duration: DUR.md }, 0)
						.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.sm }, 0);
					return () => {
						tl.kill();
						gsap.set(panel, { clearProps: "transform" });
						gsap.set(backdrop, { clearProps: "opacity,visibility" });
					};
				}
				const tl = gsap.timeline({ defaults: { ease: EASE.exit } });
				tl.to(panel, { xPercent: -100, duration: DUR.xs }, 0)
					.to(backdrop, { autoAlpha: 0, duration: DUR.xs }, 0);
				return () => {
					tl.kill();
					gsap.set(panel, { clearProps: "transform" });
					gsap.set(backdrop, { clearProps: "opacity,visibility" });
				};
			});

			return () => mm.revert();
		},
		{ scope: drawerRef, dependencies: [isOpen] },
	);

	// Reviews row microcopy: always a string (loading / empty / count / error)
	// so the row stays two-line and the nav below it never shifts as the
	// due-cards query resolves. Shared with the desktop Sidebar.
	const reviewsSubLabel = useReviewsSubLabel();

	return (
		<>
			{/* Backdrop. Decorative scrim → GSAP autoAlpha (§2.10). The opacity
          classes are the instant reduced-motion / no-JS baseline; the GSAP
          effect animates the fade and clears its inline props on cleanup. */}
			<div
				ref={backdropRef}
				data-drawer-backdrop
				aria-hidden="true"
				onClick={close}
				className={[
					"lg:hidden fixed inset-0 z-[var(--z-nav)] bg-sumi-ink/40",
					isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
				].join(" ")}
			/>

			{/* Drawer */}
			<div
				ref={drawerRef}
				data-drawer-panel
				role="dialog"
				aria-modal="true"
				aria-label="Menu"
				aria-hidden={!isOpen}
				inert={!isOpen}
				className={[
					"lg:hidden fixed inset-y-0 left-0 z-[var(--z-overlay)] w-[85vw] max-w-[320px] bg-warm-paper-raised flex flex-col",
					"transform",
					"border-r border-soft-hairline",
					// Instant reduced-motion / no-JS baseline position; the GSAP effect
					// (§2.10) animates the x-slide and clears its inline transform on
					// cleanup so this class state takes back over. Panel stays visible
					// (opacity untouched) so the nav inside stays in the a11y tree.
					isOpen ? "translate-x-0" : "-translate-x-full",
				].join(" ")}
			>
				{/* Top vermillion hairline rule */}
				<span
					aria-hidden="true"
					className="absolute inset-x-0 top-0 h-px bg-inari-vermillion/60 z-20"
				/>

				{/* Drawer header */}
				<div className="relative flex items-center justify-between h-16 px-4 border-b border-soft-hairline shrink-0">
					<Link
						href="/today"
						aria-label="Go to Reviews"
						onClick={close}
						className="rounded-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
					>
						<Logo size={48} wordmarkSize="lg" priority />
					</Link>
					<button
						ref={closeButtonRef}
						type="button"
						onClick={close}
						aria-label="Close menu"
						className="flex items-center justify-center w-11 h-11 -mr-2 rounded-xs text-sumi-ink hover:bg-cream-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 transition-colors"
					>
						<IconClose aria-hidden="true" className="w-5 h-5" />
					</button>
				</div>

				{/* Primary CTA — sits between brand bar and section nav. The
            today strip is desktop-only; on tablet and mobile the date
            wasn't earning its vertical real estate inside the drawer. */}
				<div className="shrink-0 border-b border-soft-hairline">
					<AddCardCta onNavigate={close} />
				</div>

				{/* Nav body */}
				<nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2">
					{NAV_SECTIONS.map((section, index) => (
						<NavSection
							key={section.label}
							label={section.label}
							kanji={section.kanji}
							isFirst={index === 0}
						>
							{section.items.map((item) => {
								// Dispatch weak-spots rows to the count-aware wrapper so
								// mobile parity matches desktop sidebar.
								const Renderer = item.hasWeakSpotCount === true ? WeakSpotCountNavItem : NavItem;
								return (
									<Renderer
										key={item.href}
										item={item}
										onNavigate={close}
										{...(item.hasDueCount === true
											? { subLabel: reviewsSubLabel }
											: {})}
									/>
								);
							})}
						</NavSection>
					))}
				</nav>

				{/* Account strip — Help moved into this menu so the drawer keeps
            only navigation + account, with secondary actions tucked away. */}
				<div className="px-2 py-3 border-t border-soft-hairline shrink-0">
					<UserMenu user={user} onItemSelect={close} />
				</div>
			</div>
		</>
	);
}
