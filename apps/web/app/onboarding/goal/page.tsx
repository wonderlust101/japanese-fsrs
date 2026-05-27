"use client";

import type { OnboardingGoal } from "@/stores/onboarding.store";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
	BookOpen,
	Briefcase,
	SpeechBubble,
	ToriiGate,
} from "@/components/icons/study-marks";
import { SampleCard } from "@/components/srs/SampleCard";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { useOnboardingGoalDevState } from "@/dev/panels/onboarding-goal";
import { NEXT_STEP, useOnboardingStore } from "@/stores/onboarding.store";

import { StepCard, StepChild } from "../_components/step-card";
import { StepFooter } from "../_components/step-footer";
import { useNumberKey } from "../_components/use-number-key";

const STEP_PATH = "/onboarding/goal" as const;

interface GoalOption {
	value: OnboardingGoal;
	Icon: React.ComponentType<{ className?: string }>;
	label: string;
	description: string;
}

const OPTIONS: ReadonlyArray<GoalOption> = [
	{ value: "jlpt", Icon: ToriiGate, label: "Pass the JLPT", description: "Structured exam preparation" },
	{ value: "anime_manga", Icon: SpeechBubble, label: "Enjoy anime and manga", description: "Real content, natural Japanese" },
	{ value: "novels", Icon: BookOpen, label: "Read novels", description: "Literary vocab and grammar" },
	{ value: "life_work", Icon: Briefcase, label: "Live or work in Japan", description: "Practical, everyday Japanese" },
];

interface GoalPreview {
	matchedDecks: number;
	word: string;
	reading: string;
	meaning: string;
}

const GOAL_PREVIEW: Record<OnboardingGoal, GoalPreview> = {
	jlpt: { matchedDecks: 14, word: "生徒", reading: "せいと", meaning: "student" },
	anime_manga: { matchedDecks: 9, word: "気持ち", reading: "きもち", meaning: "feeling, mood" },
	novels: { matchedDecks: 11, word: "記憶", reading: "きおく", meaning: "memory, recollection" },
	life_work: { matchedDecks: 8, word: "会議", reading: "かいぎ", meaning: "meeting, conference" },
};

const PLACEHOLDER_PREVIEW: GoalPreview = {
	matchedDecks: 0,
	word: "友",
	reading: "とも",
	meaning: "friend",
};

export default function GoalPage(): React.JSX.Element {
	useOnboardingGoalDevState();
	const router = useRouter();
	const goal = useOnboardingStore(s => s.goal);
	const setGoal = useOnboardingStore(s => s.actions.setGoal);
	const applyStepDefault = useOnboardingStore(s => s.actions.applyStepDefault);

	const handleSelect = useCallback(
		(value: OnboardingGoal) => {
			// Re-tapping the currently-selected card deselects it.
			setGoal(goal === value ? null : value);
		},
		[goal, setGoal],
	);

	const isSkipping = goal === null;

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

	const preview = useMemo(
		() => goal !== null ? GOAL_PREVIEW[goal] : PLACEHOLDER_PREVIEW,
		[goal],
	);

	return (
		<StepCard
			previewPane={(
				<SampleCard
					word={preview.word}
					reading={preview.reading}
					meaning={preview.meaning}
					caption={
						goal !== null
							? `${preview.matchedDecks} decks · ~12k cards`
							: "pick a goal to see a sample"
					}
					changeKey={goal ?? "placeholder"}
				/>
			)}
			heading="What are you here for?"
			subhead="Your goal shapes the words and grammar we surface first. The preview shows a card you'd see early on."
			footer={(
				<StepFooter
					showBack
					isSkipping={isSkipping}
					continueLabel={isSkipping ? "Skip this step" : "Continue"}
					onContinue={handleContinue}
				/>
			)}
		>
			<div role="group" aria-label="Learning goal" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{OPTIONS.map(opt => (
					<StepChild key={opt.value}>
						<SelectionCard
							selected={goal === opt.value}
							onSelect={() => handleSelect(opt.value)}
							glyph={<opt.Icon className="text-inari-vermillion-deep" />}
							label={opt.label}
							description={opt.description}
						/>
					</StepChild>
				))}
			</div>
		</StepCard>
	);
}
