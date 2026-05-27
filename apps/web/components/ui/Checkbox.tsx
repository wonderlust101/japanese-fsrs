"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CheckboxProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	ariaLabel?: string;
	id?: string;
	disabled?: boolean;
	className?: string;
}

// Themed native checkbox. Square with hairline border on warm paper; when
// checked, the box fills vermillion and a paper-white check renders inside.
// No glyph guessing for new learners; the affordance is entirely conventional.
//
// Use Checkbox.Row when you want a full-width clickable row with the label
// on the right; use Checkbox bare when you're composing alongside other
// elements (e.g. in a list-row cell).

function CheckboxRoot({
	checked,
	onChange,
	ariaLabel,
	id,
	disabled,
	className,
}: CheckboxProps): React.JSX.Element {
	return (
		<button
			{...(id !== undefined && { id })}
			type="button"
			role="checkbox"
			aria-checked={checked}
			{...(ariaLabel !== undefined && { "aria-label": ariaLabel })}
			disabled={disabled === true}
			onClick={() => {
				if (disabled !== true)
					onChange(!checked);
			}}
			className={cn(
				"group relative inline-flex h-5 w-5 shrink-0 items-center justify-center",
				"rounded-xs border transition-colors duration-150 ease-out",
				"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				// Invisible padding extends the click target to 44×44 (WCAG 2.5.5)
				// without growing the visible glyph. Clicks anywhere in the pseudo's
				// bounds bubble to the button below — standard hit-area pattern.
				"before:absolute before:-inset-3 before:content-[\"\"]",
				checked
					? "border-inari-vermillion bg-inari-vermillion"
					: "border-soft-hairline bg-warm-paper-raised hover:border-faded-sumi",
				disabled === true && "opacity-50 cursor-not-allowed",
				className,
			)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				className={cn(
					"h-3.5 w-3.5 transition-opacity duration-150 ease-out",
					checked ? "opacity-100" : "opacity-0",
				)}
			>
				<path
					d="M3.5 8.5 L7 12 L13 5"
					fill="none"
					stroke="var(--color-warm-paper-raised)"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}

interface CheckboxRowProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: ReactNode;
	description?: ReactNode;
	disabled?: boolean;
	className?: string;
}

// CheckboxRow mirrors DefRow's outer chrome and grid layout. The outer
// element is a non-interactive <div> so only the checkbox itself is the
// hit target — matching DefRow, where only the Segmented control responds
// to clicks (not the row's label or description text).
function CheckboxRow({
	checked,
	onChange,
	label,
	description,
	disabled,
	className,
}: CheckboxRowProps): React.JSX.Element {
	return (
		<div
			className={cn(
				"group grid w-full gap-2 border-t border-soft-hairline/70 py-4 first:border-t-0 first:pt-0",
				// Mirror DefRow: fixed 25rem control column so the checkbox sits on
				// the same vertical axis as the segmented controls in DefRows.
				"sm:grid-cols-[1fr_25rem] sm:gap-x-6 sm:gap-y-1",
				disabled === true && "opacity-60",
				className,
			)}
		>
			<span className="min-w-0 text-base font-medium text-sumi-ink">
				{label}
			</span>
			{/* Cell holds the checkbox in a 38px-tall box so the row's right-side
          visual mass matches the Segmented control's height in DefRow rows
          (post-bump for WCAG 2.5.8 touch target). Only the CheckboxRoot
          button below is the hit target — clicks on this empty cell space
          don't toggle. */}
			<span className="flex h-[38px] shrink-0 items-center justify-start sm:row-start-1 sm:col-start-2 sm:self-center sm:justify-self-end">
				<CheckboxRoot
					checked={checked}
					onChange={onChange}
					{...(typeof label === "string" && { ariaLabel: label })}
					{...(disabled !== undefined && { disabled })}
				/>
			</span>
			{description !== undefined && (
				<span className="block text-sm leading-relaxed text-faded-sumi sm:row-start-2 sm:col-start-1 sm:max-w-measure">
					{description}
				</span>
			)}
		</div>
	);
}

export const Checkbox = Object.assign(CheckboxRoot, { Row: CheckboxRow });
