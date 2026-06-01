"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DUR, EASE } from "@/lib/motion/easings";
import { gsap, useGSAP } from "@/lib/motion/register";

type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

interface DialogProps {
	open: boolean;
	onClose: () => void;
	/**
	 * Heading text. Optional: omit it together with an `eyebrow` and the
	 * eyebrow is promoted to title scale and serves as the dialog heading
	 * (used by the Memory popup). When present, renders as the h2 with the
	 * eyebrow above it at small scale.
	 */
	title?: string;
	/**
	 * Optional brand eyebrow rendered above the title. Mirrors the
	 * `PageHeader` rhythm (kanji + small-caps label) so the modal reads as
	 * part of the Tomo register, not a generic system popup.
	 *
	 * Pass `null` (or omit) to keep the title-only header.
	 */
	eyebrow?: { kanji: string; label: string } | null;
	/**
	 * Accessible name fallback. Only used when neither `title` nor `eyebrow`
	 * is provided; otherwise the rendered heading names the dialog via
	 * `aria-labelledby`. Provide this for headingless dialogs.
	 */
	ariaLabel?: string;
	/** Maximum width tier. Defaults to `md` (28rem) for legacy callers. */
	size?: DialogSize;
	children: React.ReactNode;
}

const SIZE_CLASS: Record<DialogSize, string> = {
	"sm": "max-w-sm", // 24rem
	"md": "max-w-md", // 28rem
	"lg": "max-w-lg", // 32rem
	"xl": "max-w-xl", // 36rem
	"2xl": "max-w-2xl", // 42rem
	"3xl": "max-w-3xl", // 48rem
	"4xl": "max-w-4xl", // 56rem
	"5xl": "max-w-5xl", // 64rem
};

/**
 * Brand-aligned modal dialog.
 *
 * Chrome mirrors `SectionCard`: 2px corners, 1px soft-hairline border, 2px
 * Inari Vermillion top stripe. Warm paper raised surface; soft sumi-ink
 * backdrop with a 2px blur for stage separation. Uses the native `<dialog>`
 * element for modal focus trap and top-layer rendering.
 *
 * Motion (per `docs/motion/DASHBOARD_MOTION_SPEC.md` §2.1): the native
 * `<dialog>` keeps owning focus/top-layer; GSAP animates ONLY the visuals. On
 * open, the backdrop fades and the box scales `0.98 → 1` + rises while fading
 * in. On close, a short reverse tween plays and the mount is held until it
 * completes (`renderOpen`) so the box can animate out before `.close()`. Because
 * GSAP can't tween the native `::backdrop`, the scrim is a real `aria-hidden`
 * `[data-dialog-backdrop]` layer inside the dialog. All gated behind
 * `prefers-reduced-motion: no-preference`; the SSR/reduced-motion path is an
 * instant open/close at the final state.
 */
export function Dialog({
	open,
	onClose,
	title,
	eyebrow,
	ariaLabel,
	size = "md",
	children,
}: DialogProps): React.JSX.Element {
	const ref = useRef<HTMLDialogElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);
	const headingId = useId();

	// Mount/visibility of the native <dialog>. Decoupled from `open` so a close
	// can hold the dialog mounted until the exit tween completes. `renderOpen`
	// drives `.showModal()`; it lags `open` only on the closing edge.
	const [renderOpen, setRenderOpen] = useState(open);

	// Open edge: sync `renderOpen` true *during render* (the React-recommended
	// "adjust state while rendering" idiom for state derived from props) so the
	// modal mounts in the same commit `open` flips true — no effect lag, no
	// set-state-in-effect. The closing edge is deferred so the exit tween can
	// play, so it is NOT derived here.
	if (open && !renderOpen)
		setRenderOpen(true);

	// The dialog is named by its rendered heading (title, or eyebrow-as-title)
	// via aria-labelledby; only headingless dialogs fall back to aria-label.
	const hasTitle = title !== undefined && title !== "";
	const hasEyebrow = eyebrow !== undefined && eyebrow !== null;
	const hasHeading = hasTitle || hasEyebrow;

	// Close edge, reduced-motion fallback: with no exit tween there's nothing to
	// wait on, so drop the mount on the next commit. (When motion is enabled the
	// GSAP effect owns the close via its timeline `onComplete`.)
	useEffect(() => {
		if (open)
			return;
		const reduce = typeof window !== "undefined"
			&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduce) {
			// eslint-disable-next-line react/set-state-in-effect -- intentional: the close must be gated on a runtime media query (matchMedia), which can only be read in an effect; this drops the held mount when there is no exit tween to await.
			setRenderOpen(false);
		}
	}, [open]);

	// Drive the native modal from `renderOpen`.
	useEffect(() => {
		const el = ref.current;
		if (!el)
			return;
		if (renderOpen && !el.open)
			el.showModal();
		if (!renderOpen && el.open)
			el.close();
	}, [renderOpen]);

	// GSAP enter/exit on the box + backdrop. Focus + top-layer stay with the
	// native element; we never touch focus here.
	useGSAP(
		() => {
			const box = boxRef.current;
			const backdrop = backdropRef.current;
			if (box === null || backdrop === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				if (open) {
					gsap.set(backdrop, { autoAlpha: 0 });
					gsap.set(box, { opacity: 0, scale: 0.98, y: 8 });
					const tl = gsap.timeline({ defaults: { ease: EASE.out } });
					tl.to(backdrop, { autoAlpha: 1, duration: DUR.sm }, 0)
						.to(box, { opacity: 1, scale: 1, y: 0, duration: DUR.md }, 0);
					return () => {
						tl.kill();
						gsap.set(box, { clearProps: "opacity,transform" });
						gsap.set(backdrop, { clearProps: "opacity,visibility" });
					};
				}

				// Exit: only meaningful if the dialog is still mounted. Hold the
				// mount via `renderOpen` until the box finishes animating out.
				if (renderOpen) {
					const tl = gsap.timeline({
						defaults: { ease: EASE.exit },
						onComplete: () => setRenderOpen(false),
					});
					tl.to(box, { opacity: 0, scale: 0.98, y: 6, duration: DUR.xs }, 0)
						.to(backdrop, { autoAlpha: 0, duration: DUR.xs }, 0);
					return () => {
						tl.kill();
					};
				}
				return undefined;
			});

			return () => mm.revert();
		},
		{ scope: ref, dependencies: [open, renderOpen] },
	);

	return (
		<dialog
			ref={ref}
			onClose={onClose}
			onCancel={(e) => {
				// Esc / dismiss requests close through the controlled prop so the
				// exit tween can play; preventDefault stops the UA from closing the
				// element out from under the animation.
				e.preventDefault();
				onClose();
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget)
					onClose();
			}}
			{...(hasHeading ? { "aria-labelledby": headingId } : ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
			className={[
				// The <dialog> is now a transparent, full-area flex centering shell so
				// it can host both the animated scrim and the box. The visual panel
				// chrome moved to the inner [data-dialog-box]. max-h / open:flex stay
				// here so the box can size against the viewport.
				"m-auto h-full max-h-none w-full max-w-none overflow-visible border-0 bg-transparent p-0 open:flex open:items-center open:justify-center",
				// Native scrim stays as the instant reduced-motion / pre-hydration
				// backdrop; the GSAP-driven [data-dialog-backdrop] layers on top of it
				// for the animated fade. Both read as the same sumi-ink stage.
				"[&::backdrop]:bg-sumi-ink/40 [&::backdrop]:backdrop-blur-[2px]",
			].join(" ")}
		>
			{/* Animated scrim. Decorative (aria-hidden) → autoAlpha. Sits behind the
          box; clicking it dismisses (mirrors the prior click-outside). */}
			<div
				ref={backdropRef}
				data-dialog-backdrop
				aria-hidden="true"
				onClick={onClose}
				className="fixed inset-0 -z-10 bg-sumi-ink/40 backdrop-blur-[2px]"
			/>

			{/* The visual modal box — the former <dialog> chrome. */}
			<div
				ref={boxRef}
				data-dialog-box
				className={[
					"relative m-auto max-h-[calc(100dvh-2rem)] w-full overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised shadow-lg flex flex-col",
					SIZE_CLASS[size],
				].join(" ")}
			>
				{/* Brand identity stripe — the same 2px Vermillion bar that crowns
            every SectionCard surface across the app. */}
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-inari-vermillion"
				/>

				{/* Pinned header: the title (context) and the close escape-hatch stay
            visible while a tall body scrolls beneath them on small viewports.
            pb-5 here reproduces the former mb-5 gap to the body. */}
				<div className="shrink-0 px-6 pt-7 pb-5">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							{hasEyebrow && hasTitle && (
								<p className="mb-1.5 flex items-baseline gap-2 font-mono text-sm text-faded-sumi">
									<span
										lang="ja"
										aria-hidden="true"
										className="font-display text-sm leading-none translate-y-[0.05em] text-inari-vermillion"
									>
										{eyebrow?.kanji}
									</span>
									<span>{eyebrow?.label}</span>
								</p>
							)}
							{hasTitle ? (
								<h2 id={headingId} className="text-lg font-medium leading-tight text-sumi-ink">{title}</h2>
							) : hasEyebrow ? (
							// Title-less mode: the eyebrow IS the heading, at title scale.
								<h2 id={headingId} className="flex items-baseline gap-3">
									<span
										lang="ja"
										aria-hidden="true"
										className="font-display text-2xl leading-none translate-y-[0.05em] text-inari-vermillion"
									>
										{eyebrow?.kanji}
									</span>
									<span className="font-mono text-lg font-medium uppercase tracking-[0.12em] text-sumi-ink">
										{eyebrow?.label}
									</span>
								</h2>
							) : null}
						</div>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							// 44px touch target on phones, tightening to the 28px pointer size
							// on sm+. Negative margins absorb the larger box so the header
							// geometry is unchanged at every size (matches card-detail-view).
							className="ui-motion-colors -my-2.5 -mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xs text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 sm:my-0 sm:-mr-1 sm:h-7 sm:w-7"
						>
							<svg
								aria-hidden="true"
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M2 2l8 8M10 2l-8 8" />
							</svg>
						</button>
					</div>
				</div>

				{/* Body scrolls within the viewport-capped box (max-h lives on the
            box). Header above stays pinned. */}
				<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
					{children}
				</div>
			</div>
		</dialog>
	);
}
