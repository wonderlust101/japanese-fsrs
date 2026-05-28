"use client";

// Desktop toolbar + touch-row primitives for the card actions strip, plus the
// example-sentence pager button. Lifted out of card-detail-view.tsx.

import Link from "next/link";

import { cn } from "@/lib/utils";

// ─── Desktop toolbar primitives ───────────────────────────────────────────

/**
 * A cluster of related tool actions, kept tight so the eye reads them as one
 *  unit; clusters are separated by `ToolDivider`.
 */
export function ToolGroup({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <div className="flex items-center gap-x-1.5">{children}</div>;
}

/**
 * Hairline rule between tool clusters. Mirrors the deck snapshot ribbon's
 *  divider so the chrome stays consistent across the app. Hidden below xl,
 *  where the toolbar wraps onto two rows and a rule would otherwise dangle at a
 *  wrap point; below xl the nav's inter-cluster gap carries the grouping.
 */
export function ToolDivider(): React.JSX.Element {
	return <div aria-hidden="true" className="hidden w-px self-stretch bg-soft-hairline xl:block" />;
}

/**
 * One icon + label action in the desktop toolbar. Renders a `Link` when `href`
 * is given, a `button` otherwise. Disabled links degrade to a non-interactive
 * span so the affordance still reads (e.g. premade cards can't be edited).
 */
export function ToolAction({
	href,
	onClick,
	icon,
	disabled,
	danger,
	title,
	ariaExpanded,
	ariaControls,
	ariaHasPopup,
	children,
}: {
	href?: string;
	onClick?: () => void;
	icon: React.ReactNode;
	disabled?: boolean;
	danger?: boolean;
	title?: string;
	ariaExpanded?: boolean;
	ariaControls?: string;
	ariaHasPopup?: "dialog" | "menu";
	children: React.ReactNode;
}): React.JSX.Element {
	const base
		= "ui-motion-colors inline-flex h-9 min-h-11 sm:min-h-0 items-center gap-2 rounded-xs px-2.5 "
			+ "focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2";
	const tone = danger === true
		? "text-inari-vermillion-deep hover:bg-inari-vermillion-deep/8 hover:text-inari-vermillion"
		: "text-sumi-ink hover:bg-cream-inset hover:text-inari-vermillion-deep";

	if (disabled === true) {
		return (
			<span
				className={`${base} cursor-not-allowed text-faded-sumi/70`}
				title={title}
				aria-disabled="true"
			>
				{icon}
				{children}
			</span>
		);
	}

	if (href !== undefined) {
		return (
			<Link href={href} className={`${base} ${tone}`}>
				{icon}
				{children}
			</Link>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			{...(ariaExpanded !== undefined ? { "aria-expanded": ariaExpanded } : {})}
			{...(ariaControls !== undefined ? { "aria-controls": ariaControls } : {})}
			{...(ariaHasPopup !== undefined ? { "aria-haspopup": ariaHasPopup } : {})}
			className={`${base} ${tone}`}
		>
			{icon}
			{children}
		</button>
	);
}

export function ActionLink({
	href,
	disabled,
	title,
	icon,
	children,
}: {
	href: string;
	disabled?: boolean;
	title?: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
}): React.JSX.Element {
	// Leading icon + label. The icon aids recognition on the touch surface; the
	// underline stays on the label only (an underlined glyph reads as broken), so
	// `group-hover` drives it rather than `hover:underline` on the whole control.
	const inner = (
		<>
			{icon}
			<span className="underline-offset-2 group-hover:underline">{children}</span>
		</>
	);
	if (disabled === true) {
		return (
			<span
				className="group inline-flex items-center gap-1.5 cursor-not-allowed text-faded-sumi/70"
				title={title}
				aria-disabled="true"
			>
				{inner}
			</span>
		);
	}
	return (
		<Link
			href={href}
			// 44px-tall touch target held across the whole compact range via vertical
			// padding cancelled by negative margin. No sm reset: this control only
			// renders below lg (the desktop toolbar replaces it), so the tablet touch
			// range must keep the full target rather than collapse it.
			className="group ui-motion-colors -my-3 inline-flex items-center gap-1.5 py-3 text-sumi-ink hover:text-inari-vermillion-deep focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
		>
			{inner}
		</Link>
	);
}

export function ActionButton({
	onClick,
	disabled,
	danger,
	icon,
	ariaExpanded,
	ariaControls,
	ariaHasPopup,
	children,
}: {
	onClick: () => void;
	disabled?: boolean;
	danger?: boolean;
	icon?: React.ReactNode;
	ariaExpanded?: boolean;
	ariaControls?: string;
	ariaHasPopup?: "dialog" | "menu";
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			{...(ariaExpanded !== undefined ? { "aria-expanded": ariaExpanded } : {})}
			{...(ariaControls !== undefined ? { "aria-controls": ariaControls } : {})}
			{...(ariaHasPopup !== undefined ? { "aria-haspopup": ariaHasPopup } : {})}
			className={[
				// Icon + label control with a 44px-tall hit area held across the whole
				// compact range (no sm reset — it only renders below lg). Underline lives
				// on the label span via group-hover so the leading icon isn't underlined.
				"group ui-motion-colors -my-3 inline-flex items-center gap-1.5 py-3",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				"disabled:cursor-not-allowed disabled:text-faded-sumi/70",
				danger === true ? "text-inari-vermillion-deep hover:text-inari-vermillion" : "text-sumi-ink hover:text-inari-vermillion-deep",
			].join(" ")}
		>
			{icon}
			<span className="underline-offset-2 group-hover:underline group-disabled:no-underline">{children}</span>
		</button>
	);
}

// Square chevron control for the example-sentence pager. Disabled at the ends
// of the list; matches the quiet font-mono register of the edit / add-review
// preview pagers so the three surfaces share one control vocabulary.
export function PagerButton({
	onClick,
	disabled,
	ariaLabel,
	children,
}: {
	onClick: () => void;
	disabled: boolean;
	ariaLabel: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			className={cn(
				"inline-flex h-6 w-6 items-center justify-center rounded-xs",
				"border border-soft-hairline font-mono text-sm leading-none",
				"transition-colors duration-150",
				disabled
					? "text-faded-sumi/40 cursor-not-allowed"
					: "text-faded-sumi hover:text-sumi-ink hover:border-sumi-ink/30",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
			)}
		>
			{children}
		</button>
	);
}
