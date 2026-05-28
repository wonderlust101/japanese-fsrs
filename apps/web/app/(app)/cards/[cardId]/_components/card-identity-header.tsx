"use client";

// The card identity header: eyebrow (deck + JLPT), headword hero, reading +
// meaning, and the suspended badge. Lifted out of card-detail-view.tsx.

import type { ApiCard } from "@fsrs-japanese/shared-types";

export function CardIdentityHeader({
	word,
	reading,
	meaning,
	deckName,
	jlptLevel,
	isSuspended,
}: {
	word: string;
	reading: string | null;
	meaning: string | null;
	deckName: string;
	jlptLevel: ApiCard["jlptLevel"];
	isSuspended: boolean;
}): React.JSX.Element {
	// Eyebrow context: where the card lives and its level. ("Card" is dropped —
	// the TopBar already establishes this is a card, so the eyebrow leads with
	// the real context.)
	const jlptLabel = jlptLevel === null
		? null
		: jlptLevel === "beyond_jlpt" ? "Beyond JLPT" : jlptLevel;
	const eyebrow = [deckName, jlptLabel].filter(
		(s): s is string => s !== null && s !== "",
	);

	return (
		<header className="flex items-start justify-between gap-4">
			<div className="min-w-0">
				<p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm text-faded-sumi">
					<span
						lang="ja"
						aria-hidden="true"
						className="font-display text-lg leading-none translate-y-[0.05em] text-inari-vermillion"
					>
						札
					</span>
					{eyebrow.map((seg, i) => (
						<span key={seg} className="inline-flex items-baseline gap-3">
							{i > 0 && <span aria-hidden="true" className="text-faded-sumi/55">·</span>}
							<span>{seg}</span>
						</span>
					))}
				</p>

				{/* Headword is the hero. CJK stack + lang="ja" so screen readers
            pronounce it and the type renders in the Japanese face. */}
				<h1
					lang="ja"
					className="mt-3 break-words font-japanese font-medium leading-tight text-sumi-ink text-title"
				>
					{word}
				</h1>

				{(reading !== null || meaning !== null) && (
					<p className="mt-1.5 flex max-w-measure flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-relaxed text-faded-sumi lg:text-base">
						{reading !== null && (
							<span lang="ja" className="font-japanese text-sumi-ink/80">{reading}</span>
						)}
						{reading !== null && meaning !== null && (
							<span aria-hidden="true" className="text-faded-sumi/55">·</span>
						)}
						{meaning !== null && <span>{meaning}</span>}
					</p>
				)}
			</div>

			{isSuspended && (
				<div className="hidden shrink-0 items-center sm:flex">
					<span className="rounded-xs border border-soft-hairline bg-cream-inset px-2.5 py-1 font-mono text-xs text-faded-sumi">
						Suspended
					</span>
				</div>
			)}
		</header>
	);
}
