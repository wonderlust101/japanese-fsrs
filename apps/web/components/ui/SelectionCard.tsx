"use client";

import { forwardRef } from "react";
import { CheckMark } from "@/components/icons/study-marks";

interface SelectionCardProps {
	selected: boolean;
	onSelect: () => void;
	/** 'stack' (glyph above label) or 'inline' (label left, trailing slot right). Default 'stack'. */
	layout?: "stack" | "inline";
	glyph?: React.ReactNode;
	label: string;
	description?: string;
	/** Optional content rendered on the right side of an inline-layout card. */
	trailing?: React.ReactNode;
	className?: string;
}

/**
 * A compact mini-card for picking one option among several. Mirrors the host
 * Card primitive's anatomy at smaller scale: hairline border, sharp 2px
 * corners, no shadow. Selected state replaces the hairline with Inari
 * Vermillion AND adds a clean line-art check at the top-right.
 */
export const SelectionCard = forwardRef<HTMLButtonElement, SelectionCardProps>(
	(
		{
			selected,
			onSelect,
			layout = "stack",
			glyph,
			label,
			description,
			trailing,
			className = "",
		},
		ref,
	) => {
		const containerLayout
			= layout === "inline"
				? "flex items-center justify-between gap-4 px-5 py-4"
				: "flex flex-col items-start gap-3 p-5";

		return (
			<button
				ref={ref}
				type="button"
				onClick={onSelect}
				aria-pressed={selected}
				className={[
					"ui-motion-pressable group relative w-full text-left rounded-xs bg-warm-paper-raised",
					"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					"border",
					selected
						? "border-inari-vermillion"
						: "border-soft-hairline hover:border-faded-sumi hover:bg-warm-paper-raised",
					containerLayout,
					className,
				].join(" ")}
			>
				{/* Selected check, top-right */}
				<span
					aria-hidden="true"
					className="absolute top-3 right-3 inline-flex text-inari-vermillion pointer-events-none"
				>
					{selected && <CheckMark />}
				</span>

				{layout === "stack"
					? (
							<>
								{glyph !== undefined && (
									<span className="ui-motion-icon inline-flex items-center justify-center text-sumi-ink/85 group-hover:text-sumi-ink">
										{glyph}
									</span>
								)}
								<span className="flex flex-col gap-0.5">
									<span className="font-medium text-sumi-ink text-base">{label}</span>
									{description !== undefined && (
										<span className="text-sm text-faded-sumi">{description}</span>
									)}
								</span>
							</>
						)
					: (
							<>
								<span className="flex items-center gap-2 min-w-0">
									{glyph !== undefined && (
										<span className="ui-motion-icon inline-flex items-center justify-center shrink-0 text-sumi-ink/85 group-hover:text-sumi-ink">
											{glyph}
										</span>
									)}
									<span className="flex flex-col gap-0.5 min-w-0">
										<span className="font-medium text-sumi-ink text-base truncate">{label}</span>
										{description !== undefined && (
											<span className="text-sm text-faded-sumi truncate">{description}</span>
										)}
									</span>
								</span>
								{trailing !== undefined && (
									<span className="shrink-0 text-right">{trailing}</span>
								)}
							</>
						)}
			</button>
		);
	},
);

SelectionCard.displayName = "SelectionCard";
