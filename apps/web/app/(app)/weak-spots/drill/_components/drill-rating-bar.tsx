"use client";

import type { ApiWeakSpotDrillAttemptResult } from "@fsrs-japanese/shared-types";

import { cn } from "@/lib/utils";

interface DrillRatingBarProps {
	onRate: (result: ApiWeakSpotDrillAttemptResult) => void;
}

// Three-channel drill rating bar. Per the doc's voice rules: labels are
// "Missed / Hesitated / Remembered" — NOT FSRS Again/Hard/Good/Easy —
// because drill attempts don't submit real reviews. The colors lean on the
// existing FSRS rating tokens for muscle memory (again ≈ missed, hard ≈
// hesitated, good ≈ remembered), but the labels themselves are different
// so the learner understands the semantic difference: this answer doesn't
// change your schedule.

interface Spec {
	value: ApiWeakSpotDrillAttemptResult;
	label: string;
	key: string;
	fill: string;
	icon: React.ReactNode;
}

const ICON_SIZE = 18;

function MissedIcon(): React.JSX.Element {
	return (
		<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M3 12a9 9 0 1 0 3.2-6.9" />
			<path d="M3 4v5h5" />
		</svg>
	);
}

function HesitatedIcon(): React.JSX.Element {
	return (
		<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v6" />
			<circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
		</svg>
	);
}

function RememberedIcon(): React.JSX.Element {
	return (
		<svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M5 12.5l4.5 4.5L19 7" />
		</svg>
	);
}

const RATINGS: readonly Spec[] = [
	{ value: "missed", label: "Missed", key: "1", fill: "var(--color-rating-again)", icon: <MissedIcon /> },
	{ value: "hesitated", label: "Hesitated", key: "2", fill: "var(--color-rating-hard)", icon: <HesitatedIcon /> },
	{ value: "remembered", label: "Remembered", key: "3", fill: "var(--color-rating-good)", icon: <RememberedIcon /> },
] as const;

export function DrillRatingBar({ onRate }: DrillRatingBarProps): React.JSX.Element {
	return (
		<div
			role="group"
			aria-label="Rate this drill card"
			className={cn(
				"fixed bottom-0 left-0 right-0 z-[var(--z-bar)]",
				"bg-warm-paper-raised border-t border-soft-hairline/60",
				"px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
			)}
		>
			<div className="mx-auto grid max-w-[560px] grid-cols-3 gap-2">
				{RATINGS.map(spec => (
					<button
						key={spec.value}
						type="button"
						onClick={() => onRate(spec.value)}
						aria-label={`${spec.label} (press ${spec.key})`}
						aria-keyshortcuts={spec.key}
						style={{ backgroundColor: spec.fill, borderColor: spec.fill }}
						className={cn(
							"group relative flex flex-col items-center justify-center gap-0.5",
							"h-16 rounded-md border px-3",
							"text-warm-paper-raised",
							"transition-[filter,transform] duration-200 ease-out",
							"cursor-pointer hover:brightness-95 active:translate-y-[1px]",
							"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink",
						)}
					>
						<span className="text-warm-paper-raised/95 leading-none inline-flex">
							{spec.icon}
						</span>
						<span className="font-medium text-sm md:text-base leading-none tracking-tight">
							{spec.label}
						</span>
						<span
							aria-hidden="true"
							className="font-mono text-sm tabular-nums leading-none text-warm-paper-raised/70"
						>
							{spec.key}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
