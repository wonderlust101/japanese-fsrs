"use client";

import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type MenuItemDensity = "compact" | "spacious";

interface MenuItemSharedProps {
	/** Optional leading glyph. Rendered in a 16×16 inline-flex slot at faded-sumi → sumi-ink on hover. */
	leading?: ReactNode;
	/** Optional trailing slot (typically a mono uppercase readout for cycling-state preferences). */
	trailing?: ReactNode;
	/** Renders a right-aligned vermillion check glyph. Trailing wins if both are provided. */
	selected?: boolean;
	/** `compact` (default): py-1.5, no item radius. `spacious`: py-2 + rounded-xs + font-medium. */
	density?: MenuItemDensity;
	/** Destructive variant: vermillion text + vermillion-wash hover/focus background. */
	danger?: boolean;
}

interface MenuItemButtonProps extends MenuItemSharedProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	children: ReactNode;
}

interface MenuItemLinkProps extends MenuItemSharedProps {
	href: string;
	children: ReactNode;
	/**
	 * Fires on click before navigation. The popover owner typically passes a
	 *  `close()` handler so the menu collapses before the route change paints.
	 */
	onClick?: MouseEventHandler<HTMLAnchorElement>;
	className?: string;
	/**
	 * Anchor `target` — passed through to the underlying `<a>`. Use `_blank`
	 *  to open in a new tab; the caller is responsible for adding `rel`.
	 */
	target?: string;
	/**
	 * Anchor `rel` — required when `target="_blank"` to mitigate tabnabbing
	 *  (`noopener noreferrer`). Passed through to the underlying `<a>`.
	 */
	rel?: string;
}

function buildClass({
	density,
	danger,
	extra,
}: {
	density: MenuItemDensity;
	danger: boolean;
	extra: string | undefined;
}): string {
	const padY = density === "spacious" ? "py-2" : "py-1.5";
	const text = density === "spacious" ? "font-medium" : "";
	const rad = density === "spacious" ? "rounded-xs" : "";

	const colors = danger
		? "text-inari-vermillion-deep hover:bg-vermillion-wash focus-visible:bg-vermillion-wash"
		: "text-sumi-ink hover:bg-cream-inset focus-visible:bg-cream-inset";

	return cn(
		"group flex w-full items-center gap-2 px-3 text-left text-sm",
		// 44px touch target on mobile (WCAG 2.5.5 AAA); release on desktop
		// so the menu stays dense at pointer-precision widths. Every
		// MenuItem consumer (sort dropdown, view picker, deck filter,
		// per-row kebab, etc.) inherits this automatically.
		"min-h-11 sm:min-h-0",
		"ui-motion-colors",
		// The cream-inset/vermillion-wash focus fill alone is too low-contrast to
		// be a reliable focus indicator; pair it with the app's standard sumi-ink
		// outline (~16:1), inset 1px so it stays within the row's bounds.
		"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:-outline-offset-1",
		"disabled:opacity-50 disabled:pointer-events-none",
		padY,
		text,
		rad,
		colors,
		extra,
	);
}

function Body({
	leading,
	trailing,
	selected,
	danger,
	children,
}: {
	leading: ReactNode | undefined;
	trailing: ReactNode | undefined;
	selected: boolean | undefined;
	danger: boolean;
	children: ReactNode;
}): React.JSX.Element {
	return (
		<>
			{leading !== undefined && (
				<span
					aria-hidden="true"
					className={cn(
						"inline-flex h-4 w-4 shrink-0 items-center justify-center",
						danger
							? "text-inari-vermillion-deep"
							: "text-faded-sumi group-hover:text-sumi-ink",
					)}
				>
					{leading}
				</span>
			)}
			<span className="flex-1 truncate">{children}</span>
			{trailing !== undefined && (
				<span className="font-mono text-sm text-faded-sumi">
					{trailing}
				</span>
			)}
			{trailing === undefined && selected === true && (
				<span aria-hidden="true" className="text-inari-vermillion">
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
						<path d="M2 6.5 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</span>
			)}
		</>
	);
}

/**
 * Themed menu item. Renders as a real `<button role="menuitem">` so keyboard
 * users and screen readers get native semantics. Use inside a popover already
 * tagged `role="menu"`.
 *
 * For navigation entries, prefer `MenuItem.Link`, which renders as Next.js
 * `<Link>` with the same styling.
 */
const MenuItemButton = forwardRef<HTMLButtonElement, MenuItemButtonProps>(
	(
		{ leading, trailing, selected, density = "compact", danger = false, className, children, ...rest },
		ref,
	) => {
		return (
			<button
				ref={ref}
				type="button"
				role="menuitem"
				className={buildClass({ density, danger, extra: className })}
				{...rest}
			>
				<Body leading={leading} trailing={trailing} selected={selected} danger={danger}>
					{children}
				</Body>
			</button>
		);
	},
);

const MenuItemLink = forwardRef<HTMLAnchorElement, MenuItemLinkProps>(
	(
		{ leading, trailing, selected, density = "compact", danger = false, className, children, href, onClick, target, rel },
		ref,
	) => {
		return (
			<Link
				ref={ref}
				href={href}
				role="menuitem"
				className={buildClass({ density, danger, extra: className })}
				{...(onClick !== undefined && { onClick })}
				{...(target !== undefined && { target })}
				{...(rel !== undefined && { rel })}
			>
				<Body leading={leading} trailing={trailing} selected={selected} danger={danger}>
					{children}
				</Body>
			</Link>
		);
	},
);

function Separator(): React.JSX.Element {
	return <div aria-hidden="true" className="my-1 h-px bg-soft-hairline" />;
}

function SectionLabel({ children }: { children: ReactNode }): React.JSX.Element {
	return (
		<p className="px-3 pt-2 pb-1 font-mono text-sm text-faded-sumi/85">
			{children}
		</p>
	);
}

export const MenuItem = Object.assign(MenuItemButton, {
	Link: MenuItemLink,
	Separator,
	SectionLabel,
});
