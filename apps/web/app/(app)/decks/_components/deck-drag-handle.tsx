"use client";

/**
 * The drag handle in the curate-mode leading column. Six dots arranged in a
 * 2x3 grid, ink-stroke style, sized to fit alongside the checkbox.
 *
 * The actual drag state machine lives in the orchestrator (deck-list.tsx).
 * This component is a thin button that emits onPointerDown so the orchestrator
 * can begin a drag transaction.
 */

interface DragHandleProps {
	onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	ariaLabel: string;
}

export function DragHandle({ onPointerDown, disabled, ariaLabel }: DragHandleProps): React.JSX.Element {
	return (
		<button
			type="button"
			onPointerDown={(e) => {
				if (disabled)
					return;
				// Prevent the surrounding row from receiving the click that would
				// toggle selection. We still let keyboard focus through.
				e.stopPropagation();
				onPointerDown(e);
			}}
			aria-label={ariaLabel}
			aria-disabled={disabled}
			title={ariaLabel}
			className={[
				"ui-motion-colors flex h-4 w-4 cursor-grab items-center justify-center rounded-xs",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				disabled
					? "cursor-not-allowed text-faded-sumi/35 hover:bg-transparent"
					: "text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink active:cursor-grabbing",
			].join(" ")}
		>
			<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
				<circle cx="2.5" cy="3" r="1.05" fill="currentColor" />
				<circle cx="7.5" cy="3" r="1.05" fill="currentColor" />
				<circle cx="2.5" cy="7" r="1.05" fill="currentColor" />
				<circle cx="7.5" cy="7" r="1.05" fill="currentColor" />
				<circle cx="2.5" cy="11" r="1.05" fill="currentColor" />
				<circle cx="7.5" cy="11" r="1.05" fill="currentColor" />
			</svg>
		</button>
	);
}
