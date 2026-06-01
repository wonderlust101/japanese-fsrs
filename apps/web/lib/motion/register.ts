"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Core GSAP entry point for the `(app)` dashboard motion — the curve/tween API
 * plus the React lifecycle hook, and NOTHING heavier.
 *
 * `gsap.registerPlugin` is idempotent, so importing this module from several
 * surfaces is safe — the plugin registers once for the bundle. Centralizing it
 * keeps every dashboard surface from re-typing the registration line (the
 * brand-register surfaces, e.g. `marketing-doc.tsx`, keep their own local
 * registration since they predate this module and live in a different tree).
 *
 * IMPORTANT — bundle hygiene: this module deliberately does NOT import or
 * register `ScrollTrigger`. `registerPlugin` is a module-scope side effect, so
 * any importer of a barrel that registers ScrollTrigger pulls ScrollTrigger
 * into its chunk — including the shared common chunk where the high-traffic
 * primitives here (Dialog, Toast/PeekPanel, StatTile, mobile-drawer) live. That
 * duplicated a copy of ScrollTrigger (the marketing chunks already ship their
 * own) and pushed `.size-limit.json` over budget. Scroll-driven surfaces import
 * the scroll plugin from `./register-scroll` instead, keeping it in their own
 * route chunk. Only the chart/heatmap draw-on needs it.
 */
gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };
