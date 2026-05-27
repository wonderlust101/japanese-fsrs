"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

/**
 * InariEditorialField — the static composed ink-on-paper still shared by the
 * auth and onboarding shells, so a learner crossing signup → onboarding never
 * sees the background language change underneath them. One field, two homes.
 *
 * The composition (faithful across both surfaces):
 *   1. hand-of-light — a warm-paper highlight drifting off the top-left;
 *   2. an oversized 友 glyph (the kanji carried in the kitsune mark) bleeding
 *      off the bottom-left corner at a whisper of sumi;
 *   3. a thin hairline rule that gives the margin editorial structure, with a
 *      short vermillion tick crossing it;
 *   4. a soft ink vignette so the corners settle and the card centers;
 *   5. (split variant only) a vermillion seam-wash bleeding the brand panel's
 *      color a few percent across the lg divide, so the two halves read as one.
 *
 * Two variants:
 *   - `split`  — auth. Clipped to the left half at `lg+` (the brand panel owns
 *     the right) and carries the seam-wash. Renders as a calm reading-side
 *     still: the drenched brand panel beside it is the animated hero, so this
 *     field stays motionless even when `live` would otherwise be available.
 *   - `full`   — onboarding. Full-bleed; no brand panel, so this field is the
 *     only brand atmosphere on the surface and earns restrained life.
 *
 * Life (`live`, honored only on the `full` variant and never under
 * `prefers-reduced-motion`):
 *   - eased pointer-parallax on the hand-of-light (nearer) and the 友 glyph
 *     (deeper), at the bounded few-px scale the brand panel uses;
 *   - a slow sub-pixel brush-breath on the glyph;
 *   - the vermillion tick rides down the rule to `progress` (0→1) as the
 *     onboarding deck depletes — a quiet ambient echo of the step row, never a
 *     competing readout.
 *
 * Decorative only (`aria-hidden`, pointer-inert): all meaning lives in the
 * surrounding DOM.
 */
interface InariEditorialFieldProps {
	variant: "split" | "full";
	/** Enable parallax + breath. Ignored on `split` and under reduced motion. */
	live?: boolean;
	/**
	 * 0→1 position of the vermillion tick along the rule. When omitted, the tick
	 * rests near the top (auth's static composition).
	 */
	progress?: number | undefined;
	className?: string;
}

export function InariEditorialField({
	variant,
	live = false,
	progress,
	className = "",
}: InariEditorialFieldProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null);
	const lightRef = useRef<HTMLDivElement>(null);
	const glyphRef = useRef<HTMLSpanElement>(null);

	const isSplit = variant === "split";
	// The reading-side still on auth stays motionless on purpose; only the
	// full-bleed onboarding field opts into life.
	const animated = live && !isSplit;

	useEffect(() => {
		if (!animated)
			return;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduceMotion || rootRef.current === null)
			return;

		const ctx = gsap.context(() => {
			// Eased setters: the pointer drives a target, GSAP smooths toward it.
			// The hand-of-light sits nearer (larger travel); the giant faint glyph
			// sits deeper (smaller travel) so it reads as parallax depth, not slide.
			const lightX = gsap.quickTo(lightRef.current, "x", { duration: 1.1, ease: "power3.out" });
			const lightY = gsap.quickTo(lightRef.current, "y", { duration: 1.1, ease: "power3.out" });
			const glyphX = gsap.quickTo(glyphRef.current, "x", { duration: 1.4, ease: "power3.out" });
			const glyphY = gsap.quickTo(glyphRef.current, "y", { duration: 1.4, ease: "power3.out" });

			function onMove(e: PointerEvent): void {
				const nx = e.clientX / window.innerWidth - 0.5;
				const ny = e.clientY / window.innerHeight - 0.5;
				lightX(nx * 16); lightY(ny * 16);
				glyphX(nx * 8); glyphY(ny * 8);
			}
			window.addEventListener("pointermove", onMove, { passive: true });

			// Slow brush-breath on the glyph; a separate transform channel (yPercent)
			// from the parallax x/y above, so the two compose without fighting.
			gsap.to(glyphRef.current, {
				yPercent: -1.6,
				duration: 6.5,
				ease: "sine.inOut",
				yoyo: true,
				repeat: -1,
			});

			return () => window.removeEventListener("pointermove", onMove);
		}, rootRef);

		return () => ctx.revert();
	}, [animated]);

	// Tick position. Static composition rests it near the top (matches auth's
	// `top-16`); progress mode glides it down the rule between 6% and 92% so it
	// never collides with the top/bottom edges.
	const hasProgress = typeof progress === "number";
	const tickTop = hasProgress
		? `${6 + Math.min(1, Math.max(0, progress)) * 86}%`
		: "4rem";

	return (
		<div
			ref={rootRef}
			aria-hidden="true"
			className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${
				isSplit ? "lg:right-1/2" : ""
			} ${className}`}
		>
			{/* 1. hand-of-light */}
			<div ref={lightRef} className="absolute inset-0 will-change-transform">
				<div
					className="absolute inset-0"
					style={{
						background:
              "radial-gradient(80% 70% at 18% 12%, color-mix(in srgb, var(--color-warm-paper-raised) 90%, transparent) 0%, transparent 60%)",
					}}
				/>
			</div>

			{/* 2. oversized 友 glyph bleeding off the bottom-left corner */}
			<span
				ref={glyphRef}
				lang="ja"
				className="absolute -bottom-[0.22em] -left-[0.06em] select-none font-semibold leading-none text-sumi-ink/[0.04] will-change-transform"
				style={{ fontSize: "min(62vh, 30rem)" }}
			>
				友
			</span>

			{/* 3. hairline rule + vermillion tick */}
			<div className="absolute inset-y-0 left-10 w-px bg-sumi-ink/[0.06] lg:left-16" />
			<div
				className="absolute left-10 h-px w-10 bg-inari-vermillion/30 lg:left-16"
				style={{
					top: tickTop,
					transition: hasProgress ? "top 700ms cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
				}}
			/>

			{/* 4. soft ink vignette */}
			<div
				className="absolute inset-0"
				style={{
					background:
            "radial-gradient(130% 100% at 50% 42%, transparent 56%, color-mix(in srgb, var(--color-sumi-ink) 5%, transparent) 100%)",
				}}
			/>

			{/* 5. vermillion seam-wash (split + lg only) */}
			{isSplit && (
				<div
					className="absolute inset-0 hidden lg:block"
					style={{
						background:
              "linear-gradient(to right, transparent 58%, color-mix(in srgb, var(--color-inari-vermillion) 7%, transparent) 100%)",
					}}
				/>
			)}
		</div>
	);
}
