/**
 * Centralized GSAP timing/easing system for the `(app)` dashboard surfaces.
 *
 * Per `docs/motion/DASHBOARD_MOTION_SPEC.md` §3, these constants are the single
 * source of truth so no surface re-types a magic number. The easing *names*
 * mirror the CSS easing tokens in `app/globals.css` (`--ease-out-expo`,
 * `--ease-out-quint`) so the GSAP and CSS systems describe the same curves and
 * stay one language.
 *
 * Entrance default is `EASE.out` (expo); data reveal is `EASE.data` (quint);
 * exits use `EASE.exit` (power2). Never use an ease-*in* on an entrance —
 * entrances decelerate into rest (the "weighted exhale"). The duration band is
 * strictly 0.18s–0.9s; only the chart draw-on (`DUR.xl`) reaches the top.
 */

export const EASE = {
	/**
	 * ↔ --ease-out-expo  cubic-bezier(0.16,1,0.3,1). Default entrance curve
	 * (card draw, nav settle, dialog/toast/peek/hero enter). The "exhale".
	 */
	out: "expo.out",
	/**
	 * ↔ --ease-out-quint cubic-bezier(0.22,1,0.36,1). Data-reveal curve
	 * (chart line draw, mature progress fill).
	 */
	data: "quint.out",
	/** auth-shell precedent: secondary settle / row cascade. */
	settle: "power3.out",
	/** Short exits and trailing cascades. */
	exit: "power2.out",
} as const;

/** Duration scale (seconds). ease-out-dominant, 0.18–0.9s band. */
export const DUR = {
	/** micro confirmations, exits */
	xs: 0.18,
	/** small enters (legend, meta, cells) */
	sm: 0.28,
	/** standard enter (dialog box, copy) */
	md: 0.34,
	/** card / hero / count-up settle */
	lg: 0.5,
	/** chart draw-on (the one long beat) */
	xl: 0.8,
} as const;

/** Stagger offsets (seconds). */
export const STAGGER = {
	/** empty-state / closure copy groups */
	copy: 0.06,
	/** multi-series chart lines */
	series: 0.08,
	/** week-rhythm strip */
	cells: 0.05,
	/** year heatmap grid sweep (per-cell) */
	heatmap: 0.004,
} as const;
