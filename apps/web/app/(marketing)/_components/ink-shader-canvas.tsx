"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-bleed sumi-ink shader for the landing hero.
 *
 * A single WebGL2 fullscreen-triangle fragment shader renders slow,
 * domain-warped fBm "ink diffusion" over the warm-paper base, with a faint
 * vermillion bloom that trails the pointer. It is deliberately low-contrast and
 * low-chroma so the Japanese headline stays the loudest thing on the fold
 * (PRODUCT Design Principle #5: "Japanese is the hero").
 *
 * Progressive enhancement, three tiers:
 *  1. No WebGL2 (or context-creation failure) → a static CSS radial wash
 *     rendered by the parent fallback layer; this component renders nothing.
 *  2. `prefers-reduced-motion: reduce` → one static frame is drawn and the RAF
 *     loop never starts. The pointer is ignored. Still a real ink texture, just
 *     frozen — the reduced-motion experience is beautiful, not blank.
 *  3. Full: a throttled RAF loop, paused whenever the hero scrolls offscreen or
 *     the tab is hidden, with DPR capped so mid-range GPUs stay at 60fps.
 *
 * No external WebGL library: the whole effect is ~one quad and ~80 lines of
 * GLSL, so three.js (~150KB) would be pure overhead. Brand value: visible craft.
 */

const VERT_SRC = /* glsl */ `#version 300 es
// Oversized fullscreen triangle — no vertex buffer needed, positions are
// derived from gl_VertexID (0,1,2). Covers the viewport with one primitive.
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;                       // 0..2 across the clip-covering triangle
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2  u_resolution;
uniform float u_time;
uniform vec2  u_pointer;   // 0..1, eased toward the cursor
uniform float u_scroll;    // 0..1 scroll progress through the hero

// Brand tokens (sRGB 0..1). Kept faint: this is paper with ink breathed onto it.
const vec3 PAPER      = vec3(0.984, 0.972, 0.957); // #FBF8F4 warm-paper-base
const vec3 SUMI       = vec3(0.122, 0.102, 0.094); // #1F1A18 sumi-ink
const vec3 VERMILLION = vec3(0.690, 0.212, 0.275); // #B03646 inari-vermillion

// --- value noise + fbm -----------------------------------------------------
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);          // smoothstep interpolation
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);    // rotate between octaves
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = ROT * p * 2.0;
    amp *= 0.5;
  }
  return v;
}

void main() {
  // Aspect-correct UVs centered at 0; keeps the ink from stretching on wide
  // viewports.
  vec2 uv = (v_uv * u_resolution - 0.5 * u_resolution) / u_resolution.y;

  float t = u_time * 0.035;                    // slow drift — "morning calm"
  vec2 p = uv * 1.6 + vec2(0.0, u_scroll * 0.6);

  // Domain warp: sample fbm, fold the result back into the coordinates, sample
  // again. This is what turns static noise into wet, marbled ink.
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.12 * t));
  float ink = fbm(p + 2.5 * r);

  // Shape the ink: bias toward paper, let only the denser pools darken. Low
  // ceiling so it reads as a wash, never as a grey overlay.
  ink = smoothstep(0.35, 0.95, ink);
  vec3 col = mix(PAPER, SUMI, ink * 0.085);

  // Vermillion bloom trailing the pointer — soft, low alpha, scaled with the
  // ink density so it pools where the ink is, like pigment meeting water.
  vec2 ptr = (u_pointer * u_resolution - 0.5 * u_resolution) / u_resolution.y;
  float d = distance(uv, ptr);
  float bloom = smoothstep(0.9, 0.0, d) * (0.10 + 0.16 * ink);
  col = mix(col, VERMILLION, bloom * 0.5);

  // Faint paper vignette so the band sits behind content rather than competing.
  float vig = smoothstep(1.25, 0.2, length(uv));
  col = mix(PAPER, col, 0.55 + 0.45 * vig);

  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
	const sh = gl.createShader(type);
	if (!sh)
		return null;
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		gl.deleteShader(sh);
		return null;
	}
	return sh;
}

export function InkShaderCanvas({ className }: { className?: string }): React.JSX.Element | null {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// `failed` flips on when WebGL2 is unavailable or shader setup throws, so the
	// parent's CSS wash shows through instead of an empty canvas.
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas)
			return;

		// `alpha: true` so the backbuffer composites with transparency: any pixel
		// the fullscreen triangle doesn't cover (a sub-pixel edge gap during a
		// DPR-rounded resize on a HiDPI/fractional-scaled display) reveals the
		// parent's light CSS wash behind it, not opaque black. With `alpha: false`
		// the uncovered seam painted near-black, which showed as a dark L-frame
		// around the hero while scrolling. Drawn pixels stay fully opaque (the
		// fragment outputs alpha 1.0), so the ink itself looks identical.
		const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" });
		if (!gl) {
			setFailed(true);
			return;
		}
		// Transparent clear colour, applied every frame before the draw so the
		// uncovered seam (if any) is transparent rather than the default black.
		gl.clearColor(0, 0, 0, 0);

		const vert = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
		const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
		const program = gl.createProgram();
		if (!vert || !frag || !program) {
			setFailed(true);
			return;
		}
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			setFailed(true);
			return;
		}
		gl.useProgram(program);

		const uResolution = gl.getUniformLocation(program, "u_resolution");
		const uTime = gl.getUniformLocation(program, "u_time");
		const uPointer = gl.getUniformLocation(program, "u_pointer");
		const uScroll = gl.getUniformLocation(program, "u_scroll");

		// DPR capped at 1.5: the ink is soft, so the extra pixels of a 3x phone
		// screen buy nothing visible but cost a lot of fill rate.
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const resize = (): void => {
			const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
			const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
				gl.viewport(0, 0, w, h);
			}
			gl.uniform2f(uResolution, canvas.width, canvas.height);
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();

		// Pointer: store a target, ease the live uniform toward it each frame.
		const target = { x: 0.5, y: 0.5 };
		const eased = { x: 0.5, y: 0.5 };
		const onPointer = (e: PointerEvent): void => {
			const rect = canvas.getBoundingClientRect();
			target.x = (e.clientX - rect.left) / rect.width;
			target.y = 1 - (e.clientY - rect.top) / rect.height; // GL y is bottom-up
		};

		let scroll = 0;
		const onScroll = (): void => {
			scroll = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
		};
		onScroll();

		const draw = (timeSeconds: number): void => {
			gl.clear(gl.COLOR_BUFFER_BIT); // wipe any edge seam to transparent first
			eased.x += (target.x - eased.x) * 0.06;
			eased.y += (target.y - eased.y) * 0.06;
			gl.uniform1f(uTime, timeSeconds);
			gl.uniform2f(uPointer, eased.x, eased.y);
			gl.uniform1f(uScroll, scroll);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		};

		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) {
			// One static frame. No loop, no listeners — the frozen ink IS the
			// reduced-motion experience.
			draw(8.0);
			return () => ro.disconnect();
		}

		window.addEventListener("pointermove", onPointer, { passive: true });
		window.addEventListener("scroll", onScroll, { passive: true });

		let raf = 0;
		let running = true;
		const start = performance.now();
		const loop = (): void => {
			if (!running)
				return;
			draw((performance.now() - start) / 1000);
			raf = requestAnimationFrame(loop);
		};

		// Pause when the hero leaves the viewport — nothing to render off-screen.
		const io = new IntersectionObserver(
			([entry]) => {
				const visible = entry?.isIntersecting ?? false;
				if (visible && !running) {
					running = true;
					raf = requestAnimationFrame(loop);
				} else if (!visible) {
					running = false;
					cancelAnimationFrame(raf);
				}
			},
			{ threshold: 0 },
		);
		io.observe(canvas);

		const onVisibility = (): void => {
			if (document.hidden) {
				running = false;
				cancelAnimationFrame(raf);
			} else if (!running) {
				running = true;
				raf = requestAnimationFrame(loop);
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		raf = requestAnimationFrame(loop);

		return () => {
			running = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			io.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("pointermove", onPointer);
			window.removeEventListener("scroll", onScroll);
			gl.deleteProgram(program);
			gl.deleteShader(vert);
			gl.deleteShader(frag);
		};
	}, []);

	if (failed)
		return null;
	return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
