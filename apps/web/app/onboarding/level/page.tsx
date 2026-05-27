"use client";

import type { OnboardingLevel } from "@/stores/onboarding.store";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { VolumeBar } from "@/components/srs/VolumeBar";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { useOnboardingLevelDevState } from "@/dev/panels/onboarding-level";
import { NEXT_STEP, useOnboardingStore } from "@/stores/onboarding.store";
import { StepCard, StepChild } from "../_components/step-card";
import { StepFooter } from "../_components/step-footer";
import { useNumberKey } from "../_components/use-number-key";

const STEP_PATH = "/onboarding/level" as const;

interface LevelOption {
	value: OnboardingLevel;
	label: string;
	description: string;
}

const OPTIONS: ReadonlyArray<LevelOption> = [
	{ value: "beginner", label: "Complete beginner", description: "Starting from zero" },
	{ value: "N5", label: "JLPT N5", description: "Basic vocab and kana" },
	{ value: "N4", label: "JLPT N4", description: "Roughly a year in" },
	{ value: "N3", label: "JLPT N3", description: "Intermediate" },
	{ value: "N2", label: "JLPT N2", description: "Upper-intermediate" },
	{ value: "N1", label: "N1 or beyond", description: "Advanced" },
];

const VOLUME_KEY_MAP: Record<OnboardingLevel, "beginner" | "N5" | "N4" | "N3" | "N2" | "N1"> = {
	beginner: "beginner",
	N5: "N5",
	N4: "N4",
	N3: "N3",
	N2: "N2",
	N1: "N1",
};

export default function LevelPage(): React.JSX.Element {
	useOnboardingLevelDevState();
	const router = useRouter();
	const level = useOnboardingStore(s => s.level);
	const setLevel = useOnboardingStore(s => s.actions.setLevel);
	const applyStepDefault = useOnboardingStore(s => s.actions.applyStepDefault);

	const handleSelect = useCallback(
		(value: OnboardingLevel) => {
			// Re-tapping the currently-selected card deselects it (returns to null
			// state). This lets the user back out without picking another option.
			setLevel(level === value ? null : value);
		},
		[level, setLevel],
	);

	const isSkipping = level === null;

	const handleContinue = useCallback(() => {
		if (isSkipping)
			applyStepDefault(STEP_PATH);
		router.push(NEXT_STEP[STEP_PATH]);
	}, [isSkipping, applyStepDefault, router]);

	const handleNumberKey = useCallback(
		(i: number) => {
			const opt = OPTIONS[i];
			if (opt)
				handleSelect(opt.value);
		},
		[handleSelect],
	);
	useNumberKey(OPTIONS.length, handleNumberKey);

	return (
		<StepCard
			previewPane={<VolumeBar selected={level !== null ? VOLUME_KEY_MAP[level] : null} />}
			heading="Where are you starting from?"
			subhead="Helps us pick a starting point. We'll adjust as we go. The bar on the left shows the typical card volume to reach each level."
			footer={(
				<StepFooter
					showBack
					onBack={() => router.push("/onboarding")}
					isSkipping={isSkipping}
					continueLabel={isSkipping ? "Skip this step" : "Continue"}
					onContinue={handleContinue}
				/>
			)}
		>
			<div role="group" aria-label="Current level" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{OPTIONS.map(opt => (
					<StepChild key={opt.value}>
						<SelectionCard
							selected={level === opt.value}
							onSelect={() => handleSelect(opt.value)}
							label={opt.label}
							description={opt.description}
						/>
					</StepChild>
				))}
			</div>
		</StepCard>
	);
}
