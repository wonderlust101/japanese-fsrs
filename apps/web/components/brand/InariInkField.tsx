"use client";

import { useEffect, useRef } from "react";

/**
 * InariInkField — a generative sumi-e ink-wash field with slowly drifting
 * study glyphs (the kana and kanji a learner will actually study), rendered to
 * a single <canvas>. It is the ambient substrate beneath the auth brand panel
 * and behind the onboarding desk.
 *
 * It is decorative only (`aria-hidden`); all meaning lives in the surrounding
 * DOM. Two surfaces are supported:
 *
 *   - `vermillion`: drawn over the saturated Inari panel. Ink washes are deep
 *     vermillion (shadow) and warm-paper cream (highlight); glyphs are cream.
 *   - `paper`: drawn behind the cool-paper onboarding desk. Everything is far
 *     fainter — a vermillion-tinted breath, not a statement — so the StepCard
 *     stays the hero.
 *
 * Motion discipline (per DESIGN.md + the shared motion laws):
 *   - `prefers-reduced-motion: reduce` → one static, composed frame. No rAF
 *     loop, no pointer listener, no drift. The still frame is itself pleasant.
 *   - Off-screen (IntersectionObserver) or backgrounded tab → the loop pauses.
 *   - Pointer parallax is opt-in via `interactive` and eased toward its target,
 *     never snapped, and bounded to a few px so it reads as depth, not slide.
 */

type Surface = "vermillion" | "paper";

interface InariInkFieldProps {
	surface: Surface;
	/** Track the pointer for parallax depth. Default true. */
	interactive?: boolean;
	className?: string;
}

const VERMILLION_DEEP = "#7E1F2A";
const CREAM = "#FDFBF7";
const VERMILLION = "#B03646";

// Real study content: a measured mix of kanji and kana a learner meets early.
// Culturally precise (study / friendship / language / the "way"), never decor
// for decoration's sake.
const GLYPHS_VERMILLION = ["学", "友", "読", "書", "語", "道", "字", "見", "あ", "き", "ま", "の", "り", "ん"];
const GLYPHS_PAPER = ["学", "友", "語", "道", "あ", "き", "ま", "り"];

interface Blob {
	bx: number;
	by: number;
	r: number;
	amp: number;
	speed: number;
	phase: number;
	depth: number;
	tone: "dark" | "light";
}

interface Glyph {
	char: string;
	bx: number;
	by: number;
	size: number;
	vx: number;
	vy: number;
	depth: number;
	rot: number;
	rotV: number;
	alpha: number;
}

function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function InariInkField({
	surface,
	interactive = true,
	className = "",
}: InariInkFieldProps): React.JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas === null)
			return;
		const ctx = canvas.getContext("2d");
		if (ctx === null)
			return;

		const reduceMotion
			= typeof window !== "undefined"
				&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const isPaper = surface === "paper";

		// Seeded so the composition is stable across renders/HMR but still organic.
		const rand = mulberry32(isPaper ? 0x70A9 : 0x1F1A18);

		const blobCount = isPaper ? 6 : 7;
		const glyphList = isPaper ? GLYPHS_PAPER : GLYPHS_VERMILLION;
		const glyphCount = isPaper ? 11 : 13;

		// Alphas tuned conservatively; iterate visually before raising.
		const darkAlpha = isPaper ? 0.05 : 0.16;
		const lightAlpha = isPaper ? 0.06 : 0.12;
		const glyphAlpha = isPaper ? 0.07 : 0.13;
		const maxParallax = isPaper ? 10 : 18;

		const blobs: Blob[] = Array.from({ length: blobCount }, () => ({
			bx: rand(),
			by: rand(),
			r: 0.28 + rand() * 0.34,
			amp: 0.02 + rand() * 0.05,
			speed: 0.04 + rand() * 0.07,
			phase: rand() * Math.PI * 2,
			depth: 0.3 + rand() * 0.7,
			tone: rand() > 0.5 ? "dark" : "light",
		}));

		const glyphs: Glyph[] = Array.from({ length: glyphCount }, (_, i) => {
			const dir = rand() > 0.5 ? 1 : -1;
			return {
				char: glyphList[i % glyphList.length] ?? "学",
				bx: rand(),
				by: rand(),
				size: (isPaper ? 0.07 : 0.1) + rand() * (isPaper ? 0.07 : 0.13),
				vx: dir * (0.004 + rand() * 0.01),
				vy: (rand() - 0.5) * 0.006,
				depth: 0.2 + rand() * 0.8,
				rot: (rand() - 0.5) * 0.5,
				rotV: (rand() - 0.5) * 0.04,
				alpha: glyphAlpha * (0.6 + rand() * 0.6),
			};
		});

		let w = 0;
		let h = 0;
		let dpr = 1;

		function resize(): void {
			if (canvas === null)
				return;
			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.max(1, Math.round(w * dpr));
			canvas.height = Math.max(1, Math.round(h * dpr));
			if (ctx === null)
				return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		// Normalized pointer target (-0.5..0.5) and the eased value the frame reads.
		const target = { x: 0, y: 0 };
		const eased = { x: 0, y: 0 };

		function onPointer(e: PointerEvent): void {
			target.x = e.clientX / window.innerWidth - 0.5;
			target.y = e.clientY / window.innerHeight - 0.5;
		}

		function draw(elapsed: number): void {
			if (ctx === null)
				return;
			const min = Math.min(w, h);
			eased.x += (target.x - eased.x) * 0.06;
			eased.y += (target.y - eased.y) * 0.06;

			ctx.clearRect(0, 0, w, h);

			// Ink washes: soft radial gradients, drifting on low-frequency sines.
			for (const b of blobs) {
				const px = eased.x * maxParallax * b.depth;
				const py = eased.y * maxParallax * b.depth;
				const cx = b.bx * w + Math.sin(elapsed * b.speed + b.phase) * (b.amp * w) + px;
				const cy = b.by * h + Math.cos(elapsed * b.speed * 0.8 + b.phase) * (b.amp * h) + py;
				const radius = b.r * min;
				const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
				const color = b.tone === "dark"
					? (isPaper ? VERMILLION : VERMILLION_DEEP)
					: CREAM;
				const alpha = b.tone === "dark" ? darkAlpha : lightAlpha;
				grad.addColorStop(0, hexA(color, alpha));
				grad.addColorStop(1, hexA(color, 0));
				ctx.fillStyle = grad;
				// Paint only the gradient's bounding box, not the whole canvas: the
				// radial stop is fully transparent past `radius`, so pixels outside the
				// square never receive ink. Cuts per-blob fill area from w×h to (2r)².
				const d = radius * 2;
				ctx.fillRect(cx - radius, cy - radius, d, d);
			}

			// Drifting study glyphs.
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			for (const g of glyphs) {
				const driftX = (g.bx + g.vx * elapsed) % 1.2 - 0.1;
				const driftY = (g.by + g.vy * elapsed) % 1.2 - 0.1;
				const px = eased.x * maxParallax * 1.6 * g.depth;
				const py = eased.y * maxParallax * 1.6 * g.depth;
				const cx = wrap(driftX) * w + px;
				const cy = wrap(driftY) * h + py;
				const fontPx = g.size * min;
				ctx.save();
				ctx.translate(cx, cy);
				ctx.rotate(g.rot + g.rotV * Math.sin(elapsed * 0.1));
				ctx.font = `400 ${fontPx}px var(--font-noto-sans-jp), "Hiragino Sans", "Yu Gothic", sans-serif`;
				ctx.fillStyle = hexA(isPaper ? VERMILLION : CREAM, g.alpha);
				ctx.fillText(g.char, 0, 0);
				ctx.restore();
			}
		}

		// The ink drift is intentionally slow, so 60fps is wasted work. Cap the
		// redraw to ~30fps: visually identical, and the main-thread/battery cost
		// roughly halves. The elapsed time fed to `draw` stays continuous, so the
		// sine-driven motion is unaffected.
		const FRAME_INTERVAL_MS = 1000 / 30;
		let raf = 0;
		let start = 0;
		let lastDraw = 0;
		let running = false;

		function loop(now: number): void {
			if (start === 0)
				start = now;
			if (now - lastDraw >= FRAME_INTERVAL_MS) {
				lastDraw = now;
				draw((now - start) / 1000);
			}
			raf = requestAnimationFrame(loop);
		}

		function play(): void {
			if (running || reduceMotion)
				return;
			running = true;
			raf = requestAnimationFrame(loop);
		}
		function pause(): void {
			running = false;
			if (raf !== 0)
				cancelAnimationFrame(raf);
			raf = 0;
		}

		resize();

		if (reduceMotion) {
			// One composed still frame, fixed phase, centered pointer.
			draw(6);
		} else {
			play();
		}

		const ro = new ResizeObserver(() => {
			resize();
			if (reduceMotion)
				draw(6);
		});
		ro.observe(canvas);

		const io = new IntersectionObserver(
			(entries) => {
				const visible = entries.some(en => en.isIntersecting);
				if (visible)
					play();
				else pause();
			},
			{ threshold: 0 },
		);
		io.observe(canvas);

		function onVisibility(): void {
			if (document.hidden)
				pause();
			else play();
		}
		document.addEventListener("visibilitychange", onVisibility);

		if (interactive && !reduceMotion) {
			window.addEventListener("pointermove", onPointer, { passive: true });
		}

		return () => {
			pause();
			ro.disconnect();
			io.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("pointermove", onPointer);
		};
	}, [surface, interactive]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className={`block h-full w-full ${className}`}
		/>
	);
}

// "#RRGGBB" + alpha → "#RRGGBBAA". Inputs are known-good literals above.
function hexA(hex: string, alpha: number): string {
	const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${a}`;
}

function wrap(v: number): number {
	const m = v % 1;
	return m < 0 ? m + 1 : m;
}
