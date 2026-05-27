"use client";

import gsap from "gsap";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { InariInkField } from "./InariInkField";

/**
 * InariBrandPanel — the drenched Inari Vermillion identity surface that fills
 * the right half of every auth screen at `lg+`. The brand register at full
 * commitment: a saturated vermillion field carrying the cream Tomo mark (the
 * canonical kitsune-on-hi-no-maru with the 友 kanji) and the wordmark, with the
 * generative InariInkField breathing behind it.
 *
 * The mark and the wordmark react to the pointer with eased parallax at two
 * depths (the mark nearer, the wordmark deeper), so moving the cursor gives the
 * panel physical depth rather than a flat poster. Honors
 * `prefers-reduced-motion`: no breath, no parallax, the composition simply rests.
 */
export function InariBrandPanel({ className = "" }: { className?: string }): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null);
	const markRef = useRef<HTMLDivElement>(null);
	const wordRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduceMotion)
			return;

		const ctx = gsap.context(() => {
			// Entrance: the cream mark resolves out of the field (scale + fade), then
			// the wordmark and line rise beneath it. Plays once on mount; the breath
			// and parallax below compose with it (separate transform channels).
			const intro = gsap.timeline();
			intro
				.from(markRef.current, { autoAlpha: 0, scale: 0.9, duration: 0.75, ease: "power3.out" })
				.from(wordRef.current, { autoAlpha: 0, y: 16, duration: 0.5, ease: "power3.out" }, "-=0.4");

			// Eased setters: pointer drives a target, GSAP smooths toward it.
			const markX = gsap.quickTo(markRef.current, "x", { duration: 0.9, ease: "power3.out" });
			const markY = gsap.quickTo(markRef.current, "y", { duration: 0.9, ease: "power3.out" });
			const wordX = gsap.quickTo(wordRef.current, "x", { duration: 1.3, ease: "power3.out" });
			const wordY = gsap.quickTo(wordRef.current, "y", { duration: 1.3, ease: "power3.out" });

			function onMove(e: PointerEvent): void {
				const nx = e.clientX / window.innerWidth - 0.5;
				const ny = e.clientY / window.innerHeight - 0.5;
				markX(nx * 22); markY(ny * 22);
				wordX(nx * 9); wordY(ny * 9);
			}
			window.addEventListener("pointermove", onMove, { passive: true });

			// Slow breath on the mark; transform-only, no layout properties.
			gsap.to(markRef.current, {
				yPercent: -2.4,
				duration: 5.5,
				ease: "sine.inOut",
				yoyo: true,
				repeat: -1,
			});

			return () => window.removeEventListener("pointermove", onMove);
		}, rootRef);

		return () => ctx.revert();
	}, []);

	return (
		<div
			ref={rootRef}
			className={`relative h-full w-full overflow-hidden ${className}`}
			style={{
				// Saturated field with a faint hand-of-light toward the upper third —
				// a background gradient (allowed), not a text gradient (banned). Stops
				// are tokens so the hero stays in lockstep with the brand vermillion.
				background:
          "radial-gradient(120% 90% at 38% 28%, var(--color-inari-vermillion-light) 0%, var(--color-inari-vermillion) 42%, var(--color-inari-vermillion-shade) 100%)",
			}}
		>
			<InariInkField surface="vermillion" className="absolute inset-0" />

			{/* Hero stack. Centered; mark and wordmark parallax at their own depths. */}
			<div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-10">
				{/* The canonical cream Tomo mark (kitsune + hi-no-maru + 友). */}
				<div ref={markRef} className="relative will-change-transform">
					<Image
						src="/brand/logo-cream.svg"
						alt="Tomo"
						width={420}
						height={420}
						priority
						unoptimized
						className="h-[min(46vh,400px)] w-[min(46vh,400px)] drop-shadow-[0_4px_18px_rgb(var(--color-inari-vermillion-deep-rgb)/0.4)]"
					/>
				</div>

				{/* Wordmark + a quiet positioning line (brand copy, not Tomo speaking). */}
				<div ref={wordRef} className="relative z-10 mt-8 flex flex-col items-center text-center will-change-transform">
					<span className="font-display text-3xl font-semibold uppercase tracking-[0.14em] text-warm-paper-raised">
						Tomo
					</span>
					<span className="mt-3 max-w-[22ch] text-sm leading-relaxed text-warm-paper-raised/90">
						A patient practice partner for Japanese. Quiet daily reviews, a teacher&rsquo;s eye for your weak spots.
					</span>
				</div>
			</div>
		</div>
	);
}
