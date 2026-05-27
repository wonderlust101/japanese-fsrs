"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { Button } from "@/components/ui/Button";

interface StepFooterProps {
	/** Show the Back button. False on Welcome. */
	showBack: boolean;
	continueLabel?: string;
	continueDisabled?: boolean;
	continueLoading?: boolean;
	/**
	 * When true, the Continue button renders as a `secondary` variant (neutral
	 * warm-paper + sumi-ink + hairline border) instead of `primary` (vermillion).
	 * Used by the adaptive Continue pattern: with a selection, the button is
	 * primary "Continue"; without a selection, the button is secondary "Skip
	 * this step", visually telling the user they're advancing without a value.
	 */
	isSkipping?: boolean;
	onContinue: () => void;
	onBack?: () => void;
	enableArrowKeys?: boolean;
}

/**
 * Shared step footer row: Back (secondary) on the left, Continue (primary) on
 * the right. Real Button components, not set-text. ArrowLeft keyboard
 * shortcut for Back, ignored when input has focus.
 */
export function StepFooter({
	showBack,
	continueLabel = "Continue",
	continueDisabled = false,
	continueLoading = false,
	isSkipping = false,
	onContinue,
	onBack,
	enableArrowKeys = true,
}: StepFooterProps): React.JSX.Element {
	const router = useRouter();

	const handleBack = useCallback(() => {
		if (onBack !== undefined)
			onBack();
		else router.back();
	}, [onBack, router]);

	useEffect(() => {
		if (!enableArrowKeys || !showBack)
			return;
		function handler(e: KeyboardEvent): void {
			if (e.key !== "ArrowLeft")
				return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable)
				return;
			e.preventDefault();
			handleBack();
		}
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [enableArrowKeys, showBack, handleBack]);

	return (
		<div className="flex items-center justify-between gap-4">
			{showBack
				? (
						<Button
							variant="secondary"
							size="md"
							onClick={handleBack}
							leadingIcon={<ArrowGlyph direction="left" />}
							aria-label="Back to previous step"
						>
							Back
						</Button>
					)
				: (
						<span aria-hidden="true" />
					)}

			<Button
				variant={isSkipping ? "secondary" : "primary"}
				size="md"
				onClick={() => {
					if (!continueDisabled && !continueLoading)
						onContinue();
				}}
				disabled={continueDisabled}
				loading={continueLoading}
				trailingIcon={<ArrowGlyph direction="right" />}
				aria-label={continueLabel}
			>
				{continueLabel}
			</Button>
		</div>
	);
}
