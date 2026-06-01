"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { DUR, EASE } from "@/lib/motion/easings";
import { gsap, useGSAP } from "@/lib/motion/register";

interface StatTileProps {
	/** Small-caps mono label above the value. */
	label: string;
	/**
	 * The figure. A formatted string (count, percentage, span) rendered in the
	 *  display face at tabular-nums so columns of figures align.
	 */
	value: string;
	/** Optional quiet sub-line beneath the value (e.g. "target 90%"). */
	hint?: ReactNode;
	/** Optional inline node after the value (e.g. "· 24 cards"). */
	trailing?: ReactNode;
	/** Render the value in vermillion-deep instead of sumi. Use sparingly. */
	accent?: boolean;
}

/**
 * Parse a formatted figure into a count-up plan. Splits a leading numeric run
 * (with optional sign, thousands separators, and decimals) from a trailing
 * unit/suffix so we can tween the number and keep the suffix static. Returns
 * `null` when the value doesn't lead with a number — those skip count-up
 * entirely (per §2.6 the count-up only runs on numeric values).
 */
function parseFigure(value: string): { target: number; decimals: number; prefix: string; suffix: string } | null {
	// Hand-scan rather than regex: a single forward pass over the string can't
	// backtrack, so it sidesteps the super-linear-backtracking lint rule while
	// staying clearer about what counts as the numeric run.
	let i = 0;
	const isDigit = (c: string): boolean => c >= "0" && c <= "9";

	// Prefix: everything before the first digit or leading sign-then-digit.
	while (i < value.length) {
		const c = value[i] ?? "";
		if (isDigit(c))
			break;
		if (c === "-" && isDigit(value[i + 1] ?? ""))
			break;
		i += 1;
	}
	if (i >= value.length)
		return null;
	const prefix = value.slice(0, i);

	const numStart = i;
	if (value[i] === "-")
		i += 1;
	let sawDigit = false;
	let dotIndex = -1;
	while (i < value.length) {
		const c = value[i] ?? "";
		if (isDigit(c)) {
			sawDigit = true;
			i += 1;
		} else if (c === ",") {
			i += 1;
		} else if (c === "." && dotIndex === -1 && isDigit(value[i + 1] ?? "")) {
			dotIndex = i - numStart;
			i += 1;
		} else {
			break;
		}
	}
	if (!sawDigit)
		return null;

	const numText = value.slice(numStart, i);
	const suffix = value.slice(i);
	const numeric = Number.parseFloat(numText.replace(/,/g, ""));
	if (Number.isNaN(numeric))
		return null;
	const decimals = dotIndex === -1 ? 0 : numText.length - dotIndex - 1;
	return { target: numeric, decimals, prefix, suffix };
}

/**
 * Format a tweened number back into the figure's shape: same decimal places and
 * locale grouping the source used, with the original prefix/suffix re-attached.
 */
function formatFigure(
	n: number,
	plan: { decimals: number; prefix: string; suffix: string },
): string {
	const body = n.toLocaleString("en-US", {
		minimumFractionDigits: plan.decimals,
		maximumFractionDigits: plan.decimals,
	});
	return `${plan.prefix}${body}${plan.suffix}`;
}

/**
 * Design-system stat tile: a mono small-caps label over a tabular display
 * figure, with optional hint and trailing slots. One fixed size (26px value,
 * 11px label) so every grid of figures reads as one family rather than
 * near-identical hand-rolled tiles at drifting scales. Currently the Insights
 * surfaces (Progress summary, Statistics activity strip, Forecast time
 * estimate); available to any future metric grid with the same intent.
 *
 * Motion (per `docs/motion/DASHBOARD_MOTION_SPEC.md` §2.6): the figure counts up
 * from 0 to its value on mount. Per constraint #3/§7 the real value `<span>`
 * stays statically in the DOM at full `opacity` (screen-reader + find-in-page
 * truth) and is never the animated node; an `aria-hidden` visual twin
 * (`[data-stat-countup]`) is what the count-up drives, layered exactly over the
 * real node and using `opacity` (never `autoAlpha`). Non-numeric values skip the
 * count-up. Gated behind `prefers-reduced-motion: no-preference` — reduced-motion
 * renders the twin at its final value instantly, real node unaffected.
 *
 * When a row of tiles mounts together, the parent may stagger their count-ups;
 * an individual tile does not self-stagger.
 *
 * Deliberately *not* the right primitive for zoned, kanji-eyebrowed ledgers
 * (e.g. the deck snapshot ribbon), which chunk figures into named actionable
 * zones and own their own type idiom on purpose.
 *
 * Renders a `<dt>`/`<dd>` pair, so it must live inside a `<dl>`.
 */
export function StatTile({
	label,
	value,
	hint,
	trailing,
	accent = false,
}: StatTileProps): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null);
	const countupRef = useRef<HTMLSpanElement>(null);
	const plan = parseFigure(value);

	const valueClass = [
		"font-display text-stat font-medium tabular-nums",
		accent ? "text-inari-vermillion-deep" : "text-sumi-ink",
	].join(" ");

	useGSAP(
		() => {
			const el = countupRef.current;
			if (el === null || plan === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const proxy = { n: 0 };
				gsap.set(el, { opacity: 0 });
				el.textContent = formatFigure(0, plan);
				const fade = gsap.to(el, { opacity: 1, duration: DUR.md, ease: EASE.out });
				const count = gsap.to(proxy, {
					n: plan.target,
					duration: DUR.lg,
					ease: EASE.out,
					onUpdate: () => {
						el.textContent = formatFigure(proxy.n, plan);
					},
				});
				return () => {
					fade.kill();
					count.kill();
					// Leave the twin showing the true final value at full opacity.
					el.textContent = value;
					gsap.set(el, { clearProps: "opacity" });
				};
			});

			return () => mm.revert();
		},
		{ scope: rootRef, dependencies: [value] },
	);

	return (
		<div ref={rootRef} className="flex flex-col gap-y-2">
			<dt className="font-mono text-sm text-faded-sumi">{label}</dt>
			<dd className="flex items-baseline gap-x-2">
				{/* The real, AT-readable figure. Stays static at full opacity — the
            count-up never touches it. When motion runs, the twin overlays it. */}
				<span className="relative inline-block">
					<span className={valueClass}>{value}</span>
					{plan !== null && (
						<span
							ref={countupRef}
							data-stat-countup
							aria-hidden="true"
							className={`absolute inset-0 ${valueClass}`}
						>
							{value}
						</span>
					)}
				</span>
				{trailing !== undefined && (
					<span className="text-base text-faded-sumi">{trailing}</span>
				)}
			</dd>
			{hint !== undefined && (
				<span className="font-mono text-sm tabular-nums text-faded-sumi">
					{hint}
				</span>
			)}
		</div>
	);
}
