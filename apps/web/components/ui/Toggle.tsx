"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

interface ToggleProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	ariaLabel: string;
	id?: string;
	disabled?: boolean;
	className?: string;
}

// A calm toggle, painted in the brand vermillion when on. No bounce, no
// elastic. Single keyboard-accessible button with role=switch.

export function Toggle({
	checked,
	onChange,
	ariaLabel,
	id,
	disabled,
	className,
}: ToggleProps): React.JSX.Element {
	return (
		<button
			id={id}
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={() => {
				if (!disabled)
					onChange(!checked);
			}}
			className={cn(
				"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
				"border border-soft-hairline transition-colors duration-200 ease-out",
				"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				checked
					? "bg-inari-vermillion border-inari-vermillion/80"
					: "bg-cream-inset hover:bg-warm-paper-raised",
				disabled === true && "opacity-50 cursor-not-allowed",
				className,
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"inline-block h-4 w-4 rounded-full bg-warm-paper-raised shadow-sm",
					"transition-transform duration-200 ease-out",
					checked ? "translate-x-6" : "translate-x-1",
				)}
			/>
		</button>
	);
}

// Segmented control: a tight horizontal group of mutually-exclusive options.
// Used for review-order / new-card-order selectors.

interface SegmentedProps<T extends string> {
	value: T;
	options: ReadonlyArray<{ value: T; label: string }>;
	onChange: (next: T) => void;
	ariaLabel: string;
	className?: string;
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	ariaLabel,
	className,
}: SegmentedProps<T>): React.JSX.Element {
	const groupRef = useRef<HTMLDivElement>(null);

	// APG radiogroup keyboard model: roving tabindex (only the selected segment
	// is tab-reachable) + Arrow keys move selection and focus together.
	function onKeyDown(e: React.KeyboardEvent): void {
		const isNext = e.key === "ArrowRight" || e.key === "ArrowDown";
		const isPrev = e.key === "ArrowLeft" || e.key === "ArrowUp";
		if (!isNext && !isPrev)
			return;
		e.preventDefault();
		const currentIndex = Math.max(0, options.findIndex(o => o.value === value));
		const nextIndex = (currentIndex + (isNext ? 1 : -1) + options.length) % options.length;
		const next = options[nextIndex];
		if (next === undefined)
			return;
		onChange(next.value);
		groupRef.current?.querySelectorAll<HTMLElement>("[role=\"radio\"]")[nextIndex]?.focus();
	}

	return (
		<div
			ref={groupRef}
			role="radiogroup"
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
			className={cn(
				"inline-flex rounded-full border border-soft-hairline bg-cream-inset p-0.5",
				className,
			)}
		>
			{options.map((opt) => {
				const selected = opt.value === value;
				return (
					<button
						key={opt.value}
						type="button"
						role="radio"
						aria-checked={selected}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(opt.value)}
						className={cn(
							// Inner buttons at py-1.5 = ~32px each + outer p-0.5 + border
							// brings each segment close to the WCAG 2.5.8 floor (24×24)
							// without making the segmented bar visually heavy.
							"rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ease-out",
							"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
							selected
								? "bg-warm-paper-raised text-sumi-ink shadow-[0_1px_0_rgba(31,26,24,0.04)]"
								: "text-faded-sumi hover:text-sumi-ink",
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
