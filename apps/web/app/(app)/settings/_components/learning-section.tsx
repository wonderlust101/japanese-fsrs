"use client";

import { isJlptLevel } from "@fsrs-japanese/shared-types";

import { useRef, useState } from "react";
import { Pill, PillGroup } from "@/components/ui/Pill";
import { SectionCard } from "@/components/ui/SectionCard";
import { TomoSlider } from "@/components/ui/TomoSlider";

import { useSettingsLearningDevState } from "@/dev/panels/settings-learning";
import { useRevealMount } from "@/hooks/use-reveal-mount";
import { ContextNote, ContextStrip } from "./context-strip";
import { SectionShell } from "./section-shell";
import { SettingsField } from "./settings-field";
import { useFieldFeedback } from "./use-field-feedback";
import { useProfileMutation } from "./use-profile-mutation";

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1", "beyond_jlpt"] as const;
type JlptLevel = (typeof JLPT_LEVELS)[number];

const INTEREST_OPTIONS = [
	"Anime & Manga",
	"Travel",
	"Business",
	"News",
	"Music",
	"Food",
	"Gaming",
	"Literature",
	"Sports",
	"Science",
	"Pop culture",
	"Slang & casual",
];

interface Props {
	initialVersion: number;
	initialJlptTarget: string | null;
	initialDailyNew: number;
	initialDailyReview: number;
	initialRetention: number;
	initialInterests: string[];
}

/**
 * Learning section: practice-tuning settings. Every control is in the
 * auto-save register (pills, sliders) per the brief's hybrid-by-sensitivity
 * rule. Each commit produces an inline ink-tick beside the field's label.
 *
 * Sliders use the bespoke TomoSlider primitive: onValueChange fires on every
 * drag step (for live readout), onValueCommit fires only on release so the
 * API is hit once per scrub.
 */
export function LearningSection({
	initialVersion,
	initialJlptTarget,
	initialDailyNew,
	initialDailyReview,
	initialRetention,
	initialInterests,
}: Props): React.JSX.Element {
	useSettingsLearningDevState();
	const feedback = useFieldFeedback();
	const saveProfile = useProfileMutation(initialVersion);

	// Single SectionCard settle (mount mode, no lead/stagger). Fields not revealed.
	const contentRef = useRef<HTMLDivElement | null>(null);
	useRevealMount(contentRef, {});

	const [jlpt, setJlpt] = useState<JlptLevel>(
		() => isJlptLevel(initialJlptTarget) ? initialJlptTarget : "N5",
	);
	const [dailyNew, setDailyNew] = useState(initialDailyNew);
	const [dailyReview, setDailyReview] = useState(initialDailyReview);
	const [retention, setRetention] = useState(initialRetention);
	const [interests, setInterests] = useState<string[]>(initialInterests);

	// Per-field "committed" values used to gate commit fires: scrubbing back
	// to the starting position should not produce a redundant PATCH.
	const [committedDailyNew, setCommittedDailyNew] = useState(initialDailyNew);
	const [committedDailyReview, setCommittedDailyReview] = useState(initialDailyReview);
	const [committedRetention, setCommittedRetention] = useState(initialRetention);

	async function commit(
		fieldId: string,
		payload: Parameters<typeof saveProfile>[0],
		rollback: () => void,
		onSuccess?: () => void,
	): Promise<void> {
		try {
			await saveProfile(payload);
			feedback.markSaved(fieldId);
			onSuccess?.();
		} catch (e) {
			rollback();
			feedback.markError(fieldId, e instanceof Error ? e.message : "Could not save.");
		}
	}

	function changeJlpt(value: JlptLevel): void {
		const prev = jlpt;
		setJlpt(value);
		void commit("jlpt-target", { jlptTarget: value }, () => setJlpt(prev));
	}

	function commitDailyNew(next: number): void {
		if (next === committedDailyNew)
			return;
		const prev = committedDailyNew;
		void commit(
			"daily-new",
			{ dailyNewCardsLimit: next },
			() => setDailyNew(prev),
			() => setCommittedDailyNew(next),
		);
	}

	function commitDailyReview(next: number): void {
		if (next === committedDailyReview)
			return;
		const prev = committedDailyReview;
		void commit(
			"daily-review",
			{ dailyReviewLimit: next },
			() => setDailyReview(prev),
			() => setCommittedDailyReview(next),
		);
	}

	function commitRetention(next: number): void {
		if (next === committedRetention)
			return;
		const prev = committedRetention;
		void commit(
			"retention",
			{ retentionTarget: next },
			() => setRetention(prev),
			() => setCommittedRetention(next),
		);
	}

	function toggleInterest(name: string): void {
		const next = interests.includes(name)
			? interests.filter(i => i !== name)
			: [...interests, name];
		const prev = interests;
		setInterests(next);
		void commit("interests", { interests: next }, () => setInterests(prev));
	}

	const retentionLoadHint
		= retention >= 0.95
			? "High retention — expect more reviews per day."
			: retention >= 0.85
				? "Balanced — Tomo's default for most learners."
				: retention >= 0.75
					? "Looser — fewer reviews, more occasional lapses."
					: "Quite loose — lapses are normal at this target.";

	return (
		<SectionShell
			heading="Learning settings"
			contentRef={contentRef}
			strip={(
				<ContextStrip>
					<ContextNote eyebrow="Daily load" title={`${dailyNew} new · up to ${dailyReview} reviews`}>
						<p>
							Tomo refills the new-card budget at midnight in your timezone. Reviews are
							capped to keep mornings finite even after a missed day.
						</p>
					</ContextNote>
					<ContextNote eyebrow="Retention" title={`${Math.round(retention * 100)}% target`}>
						<p>{retentionLoadHint}</p>
						<p>
							FSRS schedules each card so you recall it at this probability when it's due.
							Higher values mean shorter intervals; lower values mean longer gaps.
						</p>
					</ContextNote>
					<ContextNote eyebrow="Interests">
						<p>
							Used only to flavour example sentences and mnemonics. Tomo never trains a
							model on what you select — these stay on your account.
						</p>
					</ContextNote>
				</ContextStrip>
			)}
		>
			<SectionCard
				id="learning"
				kanji="学"
				reveal
				label="Learning"
				description="How firmly you practice, and what Tomo writes about."
				variant="compact"
			>
				<div className="flex flex-col gap-y-6">
					<SettingsField
						label="JLPT target"
						saved={feedback.isSaved("jlpt-target")}
						error={feedback.getError("jlpt-target")}
					>
						<PillGroup compact>
							{JLPT_LEVELS.map(lvl => (
								<Pill
									key={lvl}
									variant="interactive"
									size="lg"
									mark="#"
									selected={jlpt === lvl}
									onClick={() => changeJlpt(lvl)}
									ariaLabel={`Set JLPT target to ${lvl === "beyond_jlpt" ? "Beyond JLPT" : lvl}`}
								>
									{lvl === "beyond_jlpt" ? "Beyond JLPT" : lvl}
								</Pill>
							))}
						</PillGroup>
					</SettingsField>

					<SettingsField
						label="Daily new cards"
						endLabel={`${dailyNew} / day`}
						saved={feedback.isSaved("daily-new")}
						error={feedback.getError("daily-new")}
						htmlFor="settings-daily-new"
					>
						<TomoSlider
							id="settings-daily-new"
							min={1}
							max={100}
							step={1}
							value={dailyNew}
							onValueChange={setDailyNew}
							onValueCommit={commitDailyNew}
							formatValue={v => `${v} / day`}
							ariaLabel="Daily new cards limit"
						/>
					</SettingsField>

					<SettingsField
						label="Daily review limit"
						endLabel={`${dailyReview} / day`}
						saved={feedback.isSaved("daily-review")}
						error={feedback.getError("daily-review")}
						htmlFor="settings-daily-review"
					>
						<TomoSlider
							id="settings-daily-review"
							min={20}
							max={1000}
							step={10}
							value={dailyReview}
							onValueChange={setDailyReview}
							onValueCommit={commitDailyReview}
							formatValue={v => `${v} / day`}
							ariaLabel="Daily review limit"
						/>
					</SettingsField>

					<SettingsField
						label="Retention target"
						endLabel={`${Math.round(retention * 100)}% remembered`}
						hint="Higher means more reviews and fewer lapses."
						saved={feedback.isSaved("retention")}
						error={feedback.getError("retention")}
						htmlFor="settings-retention"
					>
						<TomoSlider
							id="settings-retention"
							min={0.6}
							max={0.99}
							step={0.01}
							value={retention}
							onValueChange={setRetention}
							onValueCommit={commitRetention}
							formatValue={v => `${Math.round(v * 100)}%`}
							ariaLabel="Retention target"
						/>
					</SettingsField>

					<SettingsField
						label="Interests"
						hint="Used to personalise the example sentences Tomo writes for you."
						saved={feedback.isSaved("interests")}
						error={feedback.getError("interests")}
					>
						<PillGroup compact>
							{INTEREST_OPTIONS.map((name) => {
								const active = interests.includes(name);
								return (
									<Pill
										key={name}
										variant="interactive"
										size="lg"
										mark="•"
										selected={active}
										onClick={() => toggleInterest(name)}
										ariaLabel={`${active ? "Remove" : "Add"} interest ${name}`}
									>
										{name}
									</Pill>
								);
							})}
						</PillGroup>
					</SettingsField>
				</div>
			</SectionCard>
		</SectionShell>
	);
}
