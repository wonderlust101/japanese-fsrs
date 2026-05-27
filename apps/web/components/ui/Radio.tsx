"use client";

import { cn } from "@/lib/utils";

interface RadioProps {
	checked: boolean;
	className?: string;
}

/**
 * Shared visual radio glyph: a 14px square with a 2px-radius hairline border
 * and an Inari Vermillion inner fill when checked. Matches the brand's
 * "cut-paper" 2px-radius vocabulary instead of the default round browser radio.
 *
 * Stateless and accessibility-free on purpose: pair with a sibling
 * `<input type="radio" className="sr-only peer" />` so the native input owns
 * keyboard navigation inside a radiogroup, then use `peer-focus-visible:*`
 * on the wrapping label to expose focus.
 */
export function Radio({ checked, className }: RadioProps): React.JSX.Element {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"ui-motion-colors flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs border bg-warm-paper-raised",
				checked
					? "border-inari-vermillion"
					: "border-soft-hairline",
				className,
			)}
		>
			{checked && <span className="block h-1.5 w-1.5 bg-inari-vermillion" />}
		</span>
	);
}
