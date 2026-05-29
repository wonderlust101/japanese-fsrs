import type { CardFields, SentenceEntry } from "./card-editor-fields";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	generateCardPreviewAction,
	generateSentencesByWordAction,
} from "@/lib/actions/cards.actions";
import { MAX_SENTENCES, nextRowKey, SENTENCE_BATCH } from "./card-editor-fields";

export interface AiCardGeneration {
	/** True while the initial seed generation is in flight (holds the form behind the loader). */
	generating: boolean;
	aiError: string | null;
	/** True while a batch of example sentences is being generated. */
	generatingBatch: boolean;
	/** How many sentences the in-flight batch will produce (drives skeleton rows). */
	pendingCount: number;
	/** Id of the single sentence row being regenerated in place, or null. */
	regeneratingId: string | null;
	/** True while the mnemonic is being regenerated. */
	regenMnemonic: boolean;
	onGenerateExamples: () => void;
	onRegenerateRow: (id: string) => void;
	onRegenMnemonic: () => void;
}

/**
 * Owns the pre-save AI generation concern for the card editor: the one-shot
 * seed-on-mount preview, batch example generation, single-row regeneration, and
 * mnemonic regeneration. It holds all the AI-progress state and writes results
 * into the card via the passed-in `setFields`; the editing/save concerns stay
 * in the component.
 *
 * All regeneration runs pre-save: no card exists yet, so the cardId-keyed
 * endpoints can't help (they look the card up server-side to extract `word`).
 * Sentences route through `generateSentencesByWordAction`; the mnemonic re-runs
 * the full preview generator and slices the field.
 */
export function useAiCardGeneration(args: {
	draftWord: string;
	needsSeed: boolean;
	fields: CardFields;
	setFields: React.Dispatch<React.SetStateAction<CardFields>>;
}): AiCardGeneration {
	const { draftWord, needsSeed, fields, setFields } = args;

	const [generating, setGenerating] = useState<boolean>(needsSeed);
	const [aiError, setAiError] = useState<string | null>(null);
	// Batch sentence generation: `pendingCount` drives the skeleton placeholder
	// rows so the author sees how many sentences are inbound.
	const [generatingBatch, setGeneratingBatch] = useState<boolean>(false);
	const [pendingCount, setPendingCount] = useState<number>(0);
	// Id of the single row being regenerated in place (null = none).
	const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
	const [regenMnemonic, setRegenMnemonic] = useState<boolean>(false);

	// ── Seed once on mount in AI path ─────────────────────────────────────
	// StrictMode (dev) and any future remount run this effect more than once.
	// The cancelled flag below guards the async setState, but not the call
	// itself — so without a persistent guard the billable generateCardPreviewAction
	// fires twice on first mount. A ref survives the remount, pinning the request
	// to exactly one dispatch.
	const seedFiredRef = useRef(false);
	useEffect(() => {
		if (!generating || seedFiredRef.current)
			return;
		seedFiredRef.current = true;
		let cancelled = false;
		void generateCardPreviewAction(draftWord.trim())
			.then((data) => {
				if (cancelled)
					return;
				// Seed every generated sentence (capped) only when the author hasn't
				// already typed their own; never clobber an in-progress edit.
				const generated = (data.exampleSentences ?? [])
					.slice(0, MAX_SENTENCES)
					.map(s => ({ id: nextRowKey(), ja: s.ja, en: s.en, furigana: s.furigana }));
				setFields(prev => ({
					...prev,
					reading: data.reading,
					meaning: data.meaning,
					partOfSpeech: data.partOfSpeech ?? prev.partOfSpeech,
					mnemonic: data.mnemonic ?? prev.mnemonic,
					pitchAccent: data.pitchAccent ?? prev.pitchAccent,
					sentences: prev.sentences.length > 0 ? prev.sentences : generated,
					kanjiBreakdown: prev.kanjiBreakdown.length > 0
						? prev.kanjiBreakdown
						: (data.kanjiBreakdown ?? []).map(k => ({ id: nextRowKey(), kanji: k.kanji, meaning: k.meaning, reading: "" })),
				}));
			})
			.catch((err: unknown) => {
				if (cancelled)
					return;
				setAiError(err instanceof Error ? err.message : "Generation failed.");
			})
			.finally(() => {
				if (!cancelled)
					setGenerating(false);
			});
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot AI generation on mount; including draftWord/generating would re-trigger generation, and generating in deps would loop (the effect sets it).
	}, []);

	// Snapshot of the current non-empty Japanese lines. Sent as `avoid` so the
	// server prompts for fresh, distinct sentences (and caches per-context), and
	// reused to dedupe what comes back.
	const existingJa = useCallback(
		(): string[] => fields.sentences.map(s => s.ja.trim()).filter(s => s.length > 0),
		[fields.sentences],
	);

	// Generate a batch in one call and append the new, deduped sentences (up to
	// the cap), routed by `word`.
	const onGenerateExamples = useCallback((): void => {
		if (generatingBatch || generating)
			return;
		const word = fields.word.trim();
		if (word.length === 0)
			return;
		const remaining = MAX_SENTENCES - fields.sentences.length;
		if (remaining <= 0)
			return;

		const want = Math.min(SENTENCE_BATCH, remaining);
		const avoid = existingJa();
		setGeneratingBatch(true); setPendingCount(want); setAiError(null);

		void generateSentencesByWordAction(word, want, avoid)
			.then((data) => {
				const seen = new Set(avoid);
				const fresh: SentenceEntry[] = [];
				for (const s of data.sentences) {
					const ja = s.ja.trim();
					if (ja.length === 0 || seen.has(ja))
						continue;
					seen.add(ja);
					fresh.push({ id: nextRowKey(), ja: s.ja, en: s.en, furigana: s.furigana });
				}
				if (fresh.length > 0) {
					setFields(prev => ({
						...prev,
						sentences: [...prev.sentences, ...fresh].slice(0, MAX_SENTENCES),
					}));
				}
			})
			.catch((err: unknown) => setAiError(err instanceof Error ? err.message : "Generation failed."))
			.finally(() => { setGeneratingBatch(false); setPendingCount(0); });
	}, [generatingBatch, generating, fields.word, fields.sentences, existingJa, setFields]);

	// Replace a single sentence in place with a fresh AI generation, telling the
	// model to avoid every current sentence so it doesn't echo what's there.
	const onRegenerateRow = useCallback((id: string): void => {
		if (regeneratingId !== null || generating)
			return;
		const word = fields.word.trim();
		if (word.length === 0)
			return;

		const avoid = existingJa();
		setRegeneratingId(id); setAiError(null);

		void generateSentencesByWordAction(word, 1, avoid)
			.then((data) => {
				const first = data.sentences[0];
				if (first !== undefined) {
					// Match by id and spread the old entry so the row keeps its key.
					setFields(prev => ({
						...prev,
						sentences: prev.sentences.map(s =>
							s.id === id ? { ...s, ja: first.ja, en: first.en, furigana: first.furigana } : s),
					}));
				}
			})
			.catch((err: unknown) => setAiError(err instanceof Error ? err.message : "Regeneration failed."))
			.finally(() => setRegeneratingId(null));
	}, [regeneratingId, generating, fields.word, existingJa, setFields]);

	const onRegenMnemonic = useCallback((): void => {
		if (regenMnemonic || generating)
			return;
		setRegenMnemonic(true); setAiError(null);

		void generateCardPreviewAction(fields.word.trim())
			.then((data) => {
				if (data.mnemonic !== undefined && data.mnemonic.length > 0) {
					setFields(prev => ({ ...prev, mnemonic: data.mnemonic ?? prev.mnemonic }));
				}
			})
			.catch((err: unknown) => setAiError(err instanceof Error ? err.message : "Regeneration failed."))
			.finally(() => setRegenMnemonic(false));
	}, [fields.word, regenMnemonic, generating, setFields]);

	return {
		generating,
		aiError,
		generatingBatch,
		pendingCount,
		regeneratingId,
		regenMnemonic,
		onGenerateExamples,
		onRegenerateRow,
		onRegenMnemonic,
	};
}
