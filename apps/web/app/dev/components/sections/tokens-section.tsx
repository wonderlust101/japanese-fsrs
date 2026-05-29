"use client";

import { useEffect, useState } from "react";
import { ShowcaseGrid, ShowcaseItem } from "../_components/showcase-item";
import { ShowcaseSection } from "../_components/showcase-section";

// Token names mirror app/globals.css — keep in sync if tokens are renamed.
const BRAND_TOKENS: ReadonlyArray<string> = [
	"--color-inari-vermillion",
	"--color-inari-vermillion-deep",
	"--color-vermillion-wash",
	"--color-aizome-indigo",
];

const NEUTRAL_TOKENS: ReadonlyArray<string> = [
	"--color-cool-paper-base",
	"--color-cool-paper-shade",
	"--color-warm-paper-base",
	"--color-warm-paper-raised",
	"--color-cream-inset",
	"--color-soft-hairline",
	"--color-faded-sumi",
	"--color-sumi-ink",
];

const JLPT_TOKENS: ReadonlyArray<string> = [
	"--color-jlpt-n5-bg",
	"--color-jlpt-n5-text",
	"--color-jlpt-n4-bg",
	"--color-jlpt-n4-text",
	"--color-jlpt-n3-bg",
	"--color-jlpt-n3-text",
	"--color-jlpt-n2-bg",
	"--color-jlpt-n2-text",
	"--color-jlpt-n1-bg",
	"--color-jlpt-n1-text",
	"--color-jlpt-beyond-bg",
	"--color-jlpt-beyond-text",
];

const DECK_TOKENS: ReadonlyArray<string> = [
	"--color-deck-n5-mark",
	"--color-deck-n5-wash",
	"--color-deck-n4-mark",
	"--color-deck-n4-wash",
	"--color-deck-n3-mark",
	"--color-deck-n3-wash",
	"--color-deck-n2-mark",
	"--color-deck-n2-wash",
	"--color-deck-n1-mark",
	"--color-deck-n1-wash",
	"--color-deck-beyond-mark",
	"--color-deck-beyond-wash",
];

const FONT_SAMPLES: ReadonlyArray<{ token: string; family: string; sample: string; lang?: string }> = [
	{ token: "--font-bricolage", family: "Bricolage Grotesque (display)", sample: "Spaced repetition" },
	{ token: "--font-dm-sans", family: "DM Sans (body)", sample: "The quick brown fox" },
	{ token: "--font-noto-sans-jp", family: "Noto Sans JP", sample: "日本語の文字", lang: "ja" },
	{ token: "--font-mono", family: "JetBrains Mono", sample: "const x = 0xFF" },
];

interface ResolvedToken {
	name: string;
	value: string;
}

function resolveTokens(tokens: ReadonlyArray<string>): ReadonlyArray<ResolvedToken> {
	if (typeof window === "undefined")
		return tokens.map(name => ({ name, value: "" }));
	const styles = window.getComputedStyle(document.documentElement);
	return tokens.map(name => ({ name, value: styles.getPropertyValue(name).trim() }));
}

export function TokensSection(): React.JSX.Element {
	const [brand, setBrand] = useState<ReadonlyArray<ResolvedToken>>([]);
	const [neutral, setNeutral] = useState<ReadonlyArray<ResolvedToken>>([]);
	const [jlpt, setJlpt] = useState<ReadonlyArray<ResolvedToken>>([]);
	const [deck, setDeck] = useState<ReadonlyArray<ResolvedToken>>([]);

	// Resolve on mount so swatches reflect the live CSS source rather than a
	// hand-mirrored copy. Stays in sync if globals.css changes.
	useEffect(() => {
		setBrand(resolveTokens(BRAND_TOKENS)); // eslint-disable-line react/set-state-in-effect -- resolves live CSS token values on mount (client-only)
		setNeutral(resolveTokens(NEUTRAL_TOKENS)); // eslint-disable-line react/set-state-in-effect -- resolves live CSS token values on mount (client-only)
		setJlpt(resolveTokens(JLPT_TOKENS)); // eslint-disable-line react/set-state-in-effect -- resolves live CSS token values on mount (client-only)
		setDeck(resolveTokens(DECK_TOKENS)); // eslint-disable-line react/set-state-in-effect -- resolves live CSS token values on mount (client-only)
	}, []);

	return (
		<ShowcaseSection
			id="tokens"
			title="Design tokens"
			description="Colors and font stacks resolved from CSS custom properties at runtime."
		>
			<SwatchGroup title="Brand" tokens={brand} />
			<SwatchGroup title="Neutrals" tokens={neutral} />
			<SwatchGroup title="JLPT spectrum" tokens={jlpt} />
			<SwatchGroup title="Deck palette" tokens={deck} />
			<FontGroup title="Typography" />
		</ShowcaseSection>
	);
}

function SwatchGroup({
	title,
	tokens,
}: {
	title: string;
	tokens: ReadonlyArray<ResolvedToken>;
}): React.JSX.Element {
	return (
		<div>
			<h3 className="text-xs text-faded-sumi mb-3">{title}</h3>
			<ShowcaseGrid minColumnWidth={180}>
				{tokens.map(token => (
					<ShowcaseItem key={token.name} label={token.name} caption={token.value || "—"}>
						<div
							className="h-12 w-full rounded-xs border border-soft-hairline"
							style={{ backgroundColor: `var(${token.name})` }}
							aria-hidden="true"
						/>
					</ShowcaseItem>
				))}
			</ShowcaseGrid>
		</div>
	);
}

function FontGroup({ title }: { title: string }): React.JSX.Element {
	return (
		<div>
			<h3 className="text-xs text-faded-sumi mb-3">{title}</h3>
			<ShowcaseGrid minColumnWidth={280}>
				{FONT_SAMPLES.map(sample => (
					<ShowcaseItem key={sample.token} label={sample.family} caption={sample.token} fill>
						<p
							lang={sample.lang}
							className="text-2xl text-sumi-ink leading-snug"
							style={{ fontFamily: `var(${sample.token}), system-ui, sans-serif` }}
						>
							{sample.sample}
						</p>
					</ShowcaseItem>
				))}
			</ShowcaseGrid>
		</div>
	);
}
