import { twMerge } from "tailwind-merge";

type ClassValue = string | number | boolean | null | undefined;

/**
 * Merges class name arguments, filtering out falsy values and de-duplicating
 * conflicting Tailwind utilities via `tailwind-merge` (last wins). This means
 * a `className` passed to a component reliably overrides the component's own
 * baked-in utility for the same property (font-size, color, margin, …) without
 * needing `!important`, the cascade-order trap that previously made size/font
 * overrides silently no-op.
 *
 * Handles the same primitives as clsx without the array/object overloads,
 * which are not needed in this codebase.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(inputs.filter(Boolean).join(" "));
}
