import type React from "react";

interface TimeProps {
	/** The instant represented: a Date, an ISO string, or epoch milliseconds. */
	value: Date | string | number;
	/**
	 * Human-readable text to show. Whatever the caller already renders —
	 *  relative ("3d ago"), humanized ("Mar 4"), or absolute — stays the visible
	 *  content; only the machine value moves into the `datetime` attribute.
	 */
	children: React.ReactNode;
	className?: string;
}

/**
 * Normalize to a machine-readable ISO 8601 value for the `datetime` attribute.
 *  Date-only ISO inputs (`YYYY-MM-DD`) are preserved as-is so the attribute
 *  stays date-precision; everything else becomes a full ISO instant. Returns
 *  '' for unparseable input.
 */
function toMachineDate(value: Date | string | number): string {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
		return value;
	const d = value instanceof Date ? value : new Date(value);
	return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Wraps temporal text in a semantic `<time datetime>` element so screen readers
 * and parsers get the machine-readable instant while sighted users keep the
 * humanized display string. Falls back to a `<span>` if `value` can't be parsed
 * (an invalid `datetime` attribute is worse than none).
 *
 * Not for SVG chart labels — SVG has no `<time>` element; those stay plain text.
 */
export function Time({ value, children, className }: TimeProps): React.JSX.Element {
	const machine = toMachineDate(value);
	if (machine === "")
		return <span className={className}>{children}</span>;
	return (
		<time dateTime={machine} className={className}>
			{children}
		</time>
	);
}
