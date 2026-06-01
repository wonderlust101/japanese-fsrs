"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";

import { gsap, useGSAP } from "@/lib/motion/register";

/**
 * Scroll-plugin entry point for the `(app)` dashboard motion.
 *
 * Importing this module registers `ScrollTrigger` (a module-scope side effect,
 * idempotent) on top of the core `register` plugins, and re-exports the core
 * `gsap`/`useGSAP` so a scroll-driven surface needs a single import line.
 *
 * This is split out from `./register` ON PURPOSE: `ScrollTrigger` is ~10kB
 * brotli, and only the Insights charts + year heatmap draw-on actually use it.
 * Keeping it out of the core barrel keeps it out of the shared common chunk
 * (where Dialog/Toast/StatTile/mobile-drawer live), so it stays in the Insights
 * route chunk instead of being double-counted against `.size-limit.json`.
 *
 * No paid plugins — the chart stroke draw uses plain SVG `strokeDashoffset`,
 * not DrawSVG.
 */
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger, useGSAP };
