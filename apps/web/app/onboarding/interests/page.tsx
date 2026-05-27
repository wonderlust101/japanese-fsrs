"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { SampleSentence } from "@/components/srs/SampleSentence";
import { Pill } from "@/components/ui/Pill";
import { useOnboardingInterestsDevState } from "@/dev/panels/onboarding-interests";
import { NEXT_STEP, useOnboardingStore } from "@/stores/onboarding.store";
import { StepCard, StepChild } from "../_components/step-card";
import { StepFooter } from "../_components/step-footer";

const STEP_PATH = "/onboarding/interests" as const;

const INTEREST_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "anime", label: "Anime" },
	{ value: "gaming", label: "Gaming" },
	{ value: "food", label: "Food" },
	{ value: "business", label: "Business" },
	{ value: "travel", label: "Travel" },
	{ value: "music", label: "Music" },
	{ value: "sports", label: "Sports" },
	{ value: "tech", label: "Tech" },
	{ value: "literature", label: "Literature" },
	{ value: "history", label: "History" },
];

interface SentenceVariant {
	chunks: ReadonlyArray<{ base: string; reading: string } | string>;
	translation: string;
	caption: string;
}

const SENTENCE_BY_INTEREST: Record<string, SentenceVariant> = {
	anime: {
		chunks: [
			"この",
			{ base: "主人公", reading: "しゅじんこう" },
			"は",
			{ base: "本当", reading: "ほんとう" },
			"に",
			{ base: "強", reading: "つよ" },
			"い。",
		],
		translation: "This protagonist is really strong.",
		caption: "flavor: anime",
	},
	gaming: {
		chunks: [
			{ base: "最後", reading: "さいご" },
			"の",
			{ base: "敵", reading: "てき" },
			"を",
			{ base: "倒", reading: "たお" },
			"した。",
		],
		translation: "I defeated the final boss.",
		caption: "flavor: gaming",
	},
	food: {
		chunks: [
			"この",
			{ base: "料理", reading: "りょうり" },
			"は",
			{ base: "本当", reading: "ほんとう" },
			"に",
			{ base: "美味", reading: "おい" },
			"しい。",
		],
		translation: "This dish is really delicious.",
		caption: "flavor: food",
	},
	business: {
		chunks: [
			{ base: "会議", reading: "かいぎ" },
			"は",
			{ base: "三時", reading: "さんじ" },
			"から",
			{ base: "始", reading: "はじ" },
			"まります。",
		],
		translation: "The meeting starts at 3.",
		caption: "flavor: business",
	},
	travel: {
		chunks: [
			{ base: "京都", reading: "きょうと" },
			"まで",
			{ base: "電車", reading: "でんしゃ" },
			"で",
			{ base: "行", reading: "い" },
			"きます。",
		],
		translation: "I go to Kyoto by train.",
		caption: "flavor: travel",
	},
	music: {
		chunks: [
			"この",
			{ base: "曲", reading: "きょく" },
			"の",
			{ base: "歌詞", reading: "かし" },
			"は",
			{ base: "美", reading: "うつく" },
			"しい。",
		],
		translation: "This song's lyrics are beautiful.",
		caption: "flavor: music",
	},
	sports: {
		chunks: [
			{ base: "試合", reading: "しあい" },
			"に",
			{ base: "勝", reading: "か" },
			"てて",
			{ base: "嬉", reading: "うれ" },
			"しい。",
		],
		translation: "I am happy we won the match.",
		caption: "flavor: sports",
	},
	tech: {
		chunks: [
			"この",
			{ base: "機能", reading: "きのう" },
			"は",
			{ base: "便利", reading: "べんり" },
			"です。",
		],
		translation: "This feature is convenient.",
		caption: "flavor: tech",
	},
	literature: {
		chunks: [
			"その",
			{ base: "小説", reading: "しょうせつ" },
			"を",
			{ base: "一晩", reading: "ひとばん" },
			"で",
			{ base: "読", reading: "よ" },
			"み",
			{ base: "終", reading: "お" },
			"えた。",
		],
		translation: "I finished that novel in one night.",
		caption: "flavor: literature",
	},
	history: {
		chunks: [
			{ base: "江戸時代", reading: "えどじだい" },
			"の",
			{ base: "建物", reading: "たてもの" },
			"です。",
		],
		translation: "It is a building from the Edo period.",
		caption: "flavor: history",
	},
};

const PLACEHOLDER_SENTENCE: SentenceVariant = {
	chunks: [
		"まずは ",
		{ base: "基本", reading: "きほん" },
		"から ",
		{ base: "始", reading: "はじ" },
		"めましょう。",
	],
	translation: "Let's start with the basics.",
	caption: "pick a topic to flavor your sentences",
};

export default function InterestsPage(): React.JSX.Element {
	useOnboardingInterestsDevState();
	const router = useRouter();
	const interests = useOnboardingStore(s => s.interests);
	const toggleInterest = useOnboardingStore(s => s.actions.toggleInterest);

	// Show the sentence flavor for the most-recently-selected interest, or
	// the placeholder when nothing is selected.
	const previewKey = interests[interests.length - 1];
	const preview = useMemo(
		() => previewKey !== undefined ? (SENTENCE_BY_INTEREST[previewKey] ?? PLACEHOLDER_SENTENCE) : PLACEHOLDER_SENTENCE,
		[previewKey],
	);

	const isSkipping = interests.length === 0;

	return (
		<StepCard
			previewPane={(
				<SampleSentence
					chunks={preview.chunks}
					translation={preview.translation}
					caption={preview.caption}
					changeKey={previewKey ?? "placeholder"}
				/>
			)}
			heading="What are you into?"
			subhead="We'll pull example sentences from here. Pick any number, or none."
			footer={(
				<StepFooter
					showBack
					isSkipping={isSkipping}
					continueLabel={isSkipping ? "Skip this step" : "Continue"}
					onContinue={() => router.push(NEXT_STEP[STEP_PATH])}
				/>
			)}
		>
			<div
				className="flex flex-wrap gap-2"
				role="group"
				aria-label="Interest topics"
			>
				{INTEREST_OPTIONS.map(opt => (
					<StepChild key={opt.value}>
						<Pill
							variant="interactive"
							size="lg"
							selected={interests.includes(opt.value)}
							mark="•"
							ariaLabel={`${interests.includes(opt.value) ? "Remove" : "Add"} interest ${opt.label}`}
							onClick={() => toggleInterest(opt.value)}
						>
							{opt.label}
						</Pill>
					</StepChild>
				))}
			</div>
		</StepCard>
	);
}
