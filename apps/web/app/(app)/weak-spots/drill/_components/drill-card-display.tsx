"use client";

import type {
	ApiWeakSpotDrillSessionDetailCard,
	FieldsData,
	LayoutType,
} from "@fsrs-japanese/shared-types";
import { getSentenceFrontBack, getWordFields } from "@fsrs-japanese/shared-types";
import { FuriganaText } from "@/components/ui/FuriganaText";
import { SectionCard } from "@/components/ui/SectionCard";

interface DrillCardDisplayProps {
	card: ApiWeakSpotDrillSessionDetailCard;
	showAnswer: boolean;
}

/**
 * Self-contained card display for the drill flow. Reads from
 * `ApiWeakSpotDrillSessionDetailCard` directly rather than reusing the review-
 * session `ReviewCard` (which depends on `ApiDueCard`'s richer shape +
 * learner preferences + deck-context queries that the drill doesn't need).
 *
 * Layouts:
 *   - vocabulary / grammar: word + furigana on top (front), meaning + reading
 *     revealed on the back.
 *   - sentence: front and back text from `fieldsData.front` / `.back`.
 *   - orphan or unknown layout: italic "card no longer exists" placeholder.
 *
 * The reveal happens via the parent's `showAnswer` prop; this component is
 * a pure projection of `(card, showAnswer)` and has no state of its own.
 */
export function DrillCardDisplay({
	card,
	showAnswer,
}: DrillCardDisplayProps): React.JSX.Element {
	if (card.fieldsData === null || card.layoutType === null) {
		return (
			<SectionCard
				omitTitle
				kanji=""
				label=""
				chrome="list"
				stripeTone="brand"
				className="w-full"
			>
				<div className="flex min-h-[16rem] items-center justify-center px-6 py-10">
					<p className="text-base italic text-faded-sumi">
						This card no longer exists.
					</p>
				</div>
			</SectionCard>
		);
	}

	return (
		<SectionCard
			omitTitle
			kanji=""
			label=""
			chrome="list"
			stripeTone="brand"
			className="w-full"
		>
			<div className="flex min-h-[18rem] flex-col gap-y-6 px-2 py-6 sm:px-4 sm:py-8">
				{renderCardBody(card.layoutType, card.fieldsData, showAnswer)}
			</div>
		</SectionCard>
	);
}

function renderCardBody(
	layoutType: LayoutType,
	fieldsData: FieldsData,
	showAnswer: boolean,
): React.JSX.Element {
	const carrier = { layoutType, fieldsData };
	if (layoutType === "sentence") {
		const sentence = getSentenceFrontBack(carrier);
		return (
			<>
				<p
					lang="ja"
					className="text-center font-display text-2xl leading-snug text-sumi-ink sm:text-3xl"
				>
					{sentence?.front ?? ""}
				</p>
				{showAnswer && (
					<p className="border-t border-soft-hairline pt-5 text-center text-base leading-relaxed text-sumi-ink">
						{sentence?.back ?? ""}
					</p>
				)}
			</>
		);
	}

	const word = getWordFields(carrier);
	if (word === null) {
		return (
			<p className="text-center text-base italic text-faded-sumi">
				This card has no readable content.
			</p>
		);
	}

	return (
		<>
			<div className="text-center">
				<span className="font-display text-4xl text-sumi-ink sm:text-5xl">
					{showAnswer && word.reading !== ""
						? (
								<FuriganaText text={word.word} reading={word.reading} />
							)
						: (
								<span lang="ja">{word.word}</span>
							)}
				</span>
			</div>
			{showAnswer && (
				<div className="flex flex-col gap-3 border-t border-soft-hairline pt-5 text-center">
					{word.reading !== "" && (
						<p className="font-mono text-sm text-faded-sumi">
							{word.reading}
						</p>
					)}
					<p className="text-base leading-relaxed text-sumi-ink sm:text-lg">
						{word.meaning}
					</p>
				</div>
			)}
		</>
	);
}
