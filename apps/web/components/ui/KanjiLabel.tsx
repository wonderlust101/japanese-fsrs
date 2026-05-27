import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type KanjiTone = "brand" | "aizome" | "error";
type KanjiLabelVariant = "eyebrow" | "section";

const TONE_CLASS: Record<KanjiTone, string> = {
	brand: "text-inari-vermillion",
	aizome: "text-aizome-indigo",
	error: "text-error",
};

interface KanjiLabelProps {
	/**
	 * Single kanji or short compound, rendered in the display face as the
	 *  leading ornament. Always `aria-hidden` — it's decorative; the readable
	 *  name is the adjacent label.
	 */
	kanji: string;
	/**
	 * Small-caps mono label rendered after the kanji. A node, so callers can
	 *  append a count or flag inline (e.g. `<>{label} · {count}</>`).
	 */
	label: ReactNode;
	/**
	 * Tier of the heading this ornament sits in:
	 *  - `eyebrow`  — page / module eyebrow: `text-lg` kanji over a faded label.
	 *  - `section`  — section heading: `text-xl` kanji over an uppercase
	 *                 sumi-ink label.
	 */
	variant?: KanjiLabelVariant;
	/**
	 * Kanji ornament tone. Defaults to brand vermillion; use `aizome` on
	 *  non-brand-stripe surfaces and `error` on error panes so the ornament
	 *  reads as deliberate.
	 */
	tone?: KanjiTone;
	/** Extra classes on the label span (rare; e.g. `break-words`). */
	labelClassName?: string;
}

/**
 * The kanji-ornament + mono-label pair that opens every Tomo heading tier
 * (page eyebrows via `PageHeader`, module/section headers, snapshot zones).
 *
 * Returns the two spans as a fragment rather than a wrapper element: each
 * caller owns its own heading element (`<h1>`, `<h2>`, `<p>`, a collapse
 * `<button>`) and any trailing siblings (counts, flags, actions). This keeps
 * one source of truth for the ornament's type scale and the vermillion
 * display register without dictating the surrounding semantics.
 */
export function KanjiLabel({
	kanji,
	label,
	variant = "section",
	tone = "brand",
	labelClassName,
}: KanjiLabelProps): React.JSX.Element {
	return (
		<>
			<span
				lang="ja"
				aria-hidden="true"
				className={cn(
					"shrink-0 select-none whitespace-nowrap font-display leading-none translate-y-[0.05em]",
					variant === "section" ? "text-xl" : "text-lg",
					TONE_CLASS[tone],
				)}
			>
				{kanji}
			</span>
			<span
				className={cn(
					variant === "section"
						? "min-w-0 break-words font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80"
						: "font-mono text-sm text-faded-sumi",
					labelClassName,
				)}
			>
				{label}
			</span>
		</>
	);
}
