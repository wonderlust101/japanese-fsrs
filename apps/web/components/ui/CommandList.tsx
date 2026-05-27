"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A keyboard-driven listbox primitive for popover-style menus. Centralises
 * the WAI-ARIA combobox-with-listbox pattern so that surfaces sharing the
 * same interaction model (chip editor, add-filter menu, future
 * command-palette work) don't reinvent the keyboard contract or drift apart
 * in subtle ways.
 *
 * Keyboard contract (matches TomoSelect):
 *   ArrowDown / ArrowUp   move highlight (wraps at ends)
 *   Home / End            jump to first / last
 *   Enter                 commit the highlighted item
 *   Esc                   close (delegated to `onEscape`)
 *   Mouse hover           updates highlight to match the hovered row
 *
 * Focus model: the consumer's input (or the trigger button, in
 * input-less variants) stays focused; the highlighted option is signalled
 * via `aria-activedescendant`. This is the WAI-ARIA-prescribed pattern
 * for typeahead listboxes and it lets screen-reader users hear option
 * announcements without having to round-trip focus on every arrow press.
 *
 * Items are passed as data, not children, so the primitive owns the keyed
 * id structure that `aria-activedescendant` needs to reference. Section
 * headers between items are expressed via the `header` field on an item;
 * they render as non-interactive rows and are skipped during keyboard
 * navigation.
 */

export interface CommandItem<TValue extends string> {
	/** Stable identifier; also used to generate the per-row DOM id. */
	value: TValue;
	label: ReactNode;
	/** Optional secondary line below the label. */
	hint?: ReactNode | undefined;
	/**
	 * Trailing badge (e.g. a count, or a "•" mark for "currently applied").
	 * Renders right-aligned inside the row.
	 */
	badge?: ReactNode | undefined;
	/** True to render the row as disabled (skipped by keyboard nav, dimmed). */
	disabled?: boolean | undefined;
	/**
	 * Section header above this row. When set, a non-interactive header row
	 * is rendered immediately before this item. Consecutive items can share
	 * a header name; only the first one renders the header.
	 */
	header?: string | undefined;
}

interface CommandListProps<TValue extends string> {
	/** The items rendered in the listbox, in display order. */
	items: ReadonlyArray<CommandItem<TValue>>;
	/** Fired when the user commits an item (Enter or click). */
	onSelect: (value: TValue) => void;
	/** Fired when the user dismisses the list via Esc. */
	onEscape?: (() => void) | undefined;
	/**
	 * If the parent owns a search/typeahead input, pass its ref so we can
	 * keep DOM focus on it while still moving `aria-activedescendant`. When
	 * omitted, the list manages its own focus (focuses the container so it
	 * can receive keystrokes).
	 */
	inputRef?: React.RefObject<HTMLInputElement | null> | undefined;
	/** ARIA label for the listbox element, when no labelling input exists. */
	ariaLabel?: string | undefined;
	/** Optional empty-state node when `items` is empty. */
	empty?: ReactNode | undefined;
	/** Index to highlight on first paint. Defaults to first non-disabled. */
	initialIndex?: number | undefined;
	/**
	 * Force 44px touch targets at every viewport. The default behavior
	 * already provides 44px on mobile and shrinks to 32px on desktop via
	 * responsive Tailwind classes; set this only when you need touch
	 * sizing on desktop too (e.g., a popover that's primarily used with
	 * trackpad-tap or pen input).
	 */
	touchTargets?: boolean | undefined;
	/** Optional className passthrough on the outer <ul>. */
	className?: string | undefined;
}

/**
 * Pure-component listbox. The consumer owns the popover chrome (position,
 * border, shadow, header); this component renders only the keyboard-aware
 * scrollable item list.
 */
export function CommandList<TValue extends string>({
	items,
	onSelect,
	onEscape,
	inputRef,
	ariaLabel,
	empty,
	initialIndex,
	touchTargets,
	className,
}: CommandListProps<TValue>): React.JSX.Element {
	const listboxId = useId();
	const rowIdBase = `${listboxId}-row`;
	const ulRef = useRef<HTMLUListElement | null>(null);

	// First non-disabled index, used both as the initial highlight and as
	// the fallback when the active row gets disabled out from under us.
	const firstSelectable = useMemo(
		() => items.findIndex(i => i.disabled !== true),
		[items],
	);
	const startIndex = initialIndex ?? firstSelectable;
	const [activeIndex, setActiveIndex] = useState<number>(startIndex);

	// Keep the highlight in range when the items list shrinks (e.g.,
	// typeahead filter narrows results).
	useEffect(() => {
		if (items.length === 0) {
			setActiveIndex(-1);
			return;
		}
		if (activeIndex >= items.length || activeIndex < 0) {
			setActiveIndex(firstSelectable);
			return;
		}
		if (items[activeIndex]?.disabled === true) {
			setActiveIndex(firstSelectable);
		}
	}, [items, activeIndex, firstSelectable]);

	// Scroll the highlighted row into view on keyboard moves so long lists
	// don't strand the cursor offscreen.
	useEffect(() => {
		const list = ulRef.current;
		if (list === null || activeIndex < 0)
			return;
		const row = list.querySelector<HTMLLIElement>(`#${rowIdBase}-${activeIndex}`);
		row?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, rowIdBase]);

	// Keyboard navigation. Attached to the list when there's no input ref,
	// attached to the input element when there is — wiring happens in the
	// effect below.
	function handleKey(e: KeyboardEvent<HTMLElement>): boolean {
		if (items.length === 0)
			return false;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex(idx => nextSelectable(items, idx, +1));
			return true;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex(idx => nextSelectable(items, idx, -1));
			return true;
		}
		if (e.key === "Home") {
			e.preventDefault();
			setActiveIndex(firstSelectable);
			return true;
		}
		if (e.key === "End") {
			e.preventDefault();
			setActiveIndex(lastSelectable(items));
			return true;
		}
		if (e.key === "Enter") {
			const item = items[activeIndex];
			if (item !== undefined && item.disabled !== true) {
				e.preventDefault();
				onSelect(item.value);
			}
			return true;
		}
		if (e.key === "Escape") {
			if (onEscape !== undefined) {
				e.preventDefault();
				onEscape();
			}
			return true;
		}
		return false;
	}

	// Forward keyboard events from an external input (typeahead variant)
	// onto our nav handler. The input keeps focus; we read keystrokes from
	// it but don't take focus away.
	useEffect(() => {
		const input = inputRef?.current;
		if (input === null || input === undefined)
			return undefined;
		const onKeyDownNative = (ev: globalThis.KeyboardEvent): void => {
			// Synthesise the minimal React-shaped event surface our handler uses.
			const synthetic: KeyboardEvent<HTMLElement> = {
				key: ev.key,
				preventDefault: () => ev.preventDefault(),
			} as KeyboardEvent<HTMLElement>;
			handleKey(synthetic);
		};
		input.addEventListener("keydown", onKeyDownNative);
		return () => input.removeEventListener("keydown", onKeyDownNative);
		// We intentionally re-bind whenever items or active index change so
		// the closure captures up-to-date state. `handleKey` is recreated
		// each render but the cleanup above runs before the next attach.
	}, [inputRef, items, activeIndex, firstSelectable]);

	// When there's no input ref, the list itself needs to receive the
	// keystrokes — we expose `tabIndex={-1}` so it's focusable
	// programmatically but not in the natural tab order.
	const selfManagedFocus = inputRef === undefined || inputRef === null;

	// Sync `aria-activedescendant` onto the input (or the listbox in
	// self-managed mode). The element id format matches the per-row id.
	const activeId = activeIndex >= 0 && items[activeIndex] !== undefined
		? `${rowIdBase}-${activeIndex}`
		: undefined;
	useEffect(() => {
		const input = inputRef?.current;
		if (input === null || input === undefined)
			return;
		if (activeId !== undefined)
			input.setAttribute("aria-activedescendant", activeId);
		else input.removeAttribute("aria-activedescendant");
	}, [activeId, inputRef]);

	// ─── Render ────────────────────────────────────────────────────────
	// Default: 44px on mobile, 32px on desktop. The mobile minimum is
	// load-bearing — every consumer (chip editor, add-filter menu, future
	// command palettes) inherits a touch-friendly row size automatically.
	// `touchTargets={true}` forces 44px everywhere when the consumer
	// wants touch density even at desktop widths.
	const rowPadding = touchTargets === true
		? "min-h-11 px-3 py-2"
		: "min-h-11 px-3 py-2 sm:min-h-[32px] sm:px-2.5 sm:py-1.5";

	if (items.length === 0) {
		return (
			<ul
				ref={ulRef}
				id={listboxId}
				role="listbox"
				aria-label={ariaLabel}
				className={cn("p-1", className)}
			>
				<li className="px-3 py-3 text-sm text-faded-sumi" aria-live="polite">
					{empty ?? "No results."}
				</li>
			</ul>
		);
	}

	// Compute headers: only render the header for the first item in each
	// contiguous run that shares the same header value.
	const renderedHeaders = new Set<string>();

	return (
		<ul
			ref={ulRef}
			id={listboxId}
			role="listbox"
			aria-label={ariaLabel}
			tabIndex={selfManagedFocus ? -1 : undefined}
			aria-activedescendant={selfManagedFocus ? activeId : undefined}
			onKeyDown={selfManagedFocus ? (e) => { handleKey(e); } : undefined}
			className={cn("max-h-[20rem] overflow-y-auto p-1 outline-none", className)}
		>
			{items.map((item, idx) => {
				const headerToRender = item.header !== undefined && !renderedHeaders.has(item.header)
					? item.header
					: null;
				if (headerToRender !== null)
					renderedHeaders.add(headerToRender);

				const isActive = idx === activeIndex && item.disabled !== true;
				const rowId = `${rowIdBase}-${idx}`;

				return (
					<li key={item.value} className="list-none">
						{headerToRender !== null && (
							<div
								aria-hidden="true"
								className="px-2.5 pt-2 pb-1 font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi"
							>
								{headerToRender}
							</div>
						)}
						<div
							id={rowId}
							role="option"
							aria-selected={isActive}
							aria-disabled={item.disabled === true ? true : undefined}
							onMouseEnter={() => {
								if (item.disabled !== true)
									setActiveIndex(idx);
							}}
							onClick={() => {
								if (item.disabled !== true)
									onSelect(item.value);
							}}
							className={cn(
								"ui-motion-colors flex w-full items-center justify-between gap-3 rounded-xs text-left text-sm",
								"cursor-pointer select-none",
								rowPadding,
								isActive ? "bg-cream-inset" : "",
								item.disabled === true ? "cursor-not-allowed opacity-50" : "text-sumi-ink hover:bg-cream-inset",
							)}
						>
							<div className="flex min-w-0 flex-col">
								<span className="truncate">{item.label}</span>
								{item.hint !== undefined && (
									<span className="font-mono text-sm text-faded-sumi">{item.hint}</span>
								)}
							</div>
							{item.badge !== undefined && (
								<span className="shrink-0 font-mono text-sm text-inari-vermillion">
									{item.badge}
								</span>
							)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}

// ─── Helpers ───────────────────────────────────────────────────────────

function nextSelectable<T extends string>(
	items: ReadonlyArray<CommandItem<T>>,
	from: number,
	step: 1 | -1,
): number {
	const n = items.length;
	if (n === 0)
		return -1;
	let idx = from;
	for (let tries = 0; tries < n; tries += 1) {
		idx = (idx + step + n) % n;
		if (items[idx]?.disabled !== true)
			return idx;
	}
	return from;
}

function lastSelectable<T extends string>(items: ReadonlyArray<CommandItem<T>>): number {
	for (let i = items.length - 1; i >= 0; i -= 1) {
		if (items[i]?.disabled !== true)
			return i;
	}
	return -1;
}

function cn(...parts: (string | false | null | undefined)[]): string {
	return parts.filter(Boolean).join(" ");
}
