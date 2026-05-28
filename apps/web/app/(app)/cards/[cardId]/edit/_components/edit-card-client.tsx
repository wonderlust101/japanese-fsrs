"use client";

import type { ApiCard, JLPTLevel } from "@fsrs-japanese/shared-types";
import type { ChangeEvent } from "react";
import type { CardFields, DeckOption, SentenceEntry } from "./card-editor-fields";

import { useRouter } from "next/navigation";

import {
	useCallback,
	useEffect,
	useMemo,
	useState,

} from "react";
import { KanjiEditor } from "@/components/card-editor/KanjiEditor";
import { SentenceEditor } from "@/components/card-editor/SentenceEditor";
import { IconEdit } from "@/components/icons/chrome-marks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { TomoSelect } from "@/components/ui/TomoSelect";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import {
	generateMnemonicAction,
	generateSentencesAction,
	moveCardAction,
	updateCardAction,
} from "@/lib/actions/cards.actions";
import { buildFieldsData, buildPreviewCard, fieldsFromCard, JLPT_OPTIONS, MAX_SENTENCES, nextRowKey, PITCH_OPTIONS, POS_OPTIONS, SENTENCE_BATCH } from "./card-editor-fields";
import { CollapsibleSection, DeckPickerCard, Frame, PreviewBlock, SaveBlock, SectionRequirement } from "./card-editor-sections";

// ── Page ──────────────────────────────────────────────────────────────────────
interface EditCardClientProps {
	card: ApiCard;
	deckName: string;
	/**
	 * The user's active decks (valid move targets), including the card's
	 *  current deck. Lets the author relocate the card while editing.
	 */
	decks: DeckOption[];
}

export function EditCardClient({ card, deckName, decks }: EditCardClientProps): React.JSX.Element {
	const router = useRouter();

	// ── Live state — seeded once from the persisted card ──────────────────
	const [fields, setFields] = useState<CardFields>(() => fieldsFromCard(card));
	const [flipped, setFlipped] = useState<boolean>(false);
	// Which example sentence the preview pins (the review back rotates; the
	// author pages through them here). Clamped against the live count at render.
	const [previewSentenceIdx, setPreviewSentenceIdx] = useState<number>(0);

	// AI regeneration is always available while editing — the card is already
	// saved, so the dedicated cardId-keyed endpoints can look it up server-side
	// to extract its `word` and existing context.
	const aiEnabled = fields.word.trim().length > 0;
	const [aiError, setAiError] = useState<string | null>(null);
	// Batch sentence generation: `pendingCount` drives the skeleton placeholder
	// rows so the author sees how many sentences are inbound.
	const [generatingBatch, setGeneratingBatch] = useState<boolean>(false);
	const [pendingCount, setPendingCount] = useState<number>(0);
	// Id of the single row being regenerated in place (null = none).
	const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
	const [regenMnemonic, setRegenMnemonic] = useState<boolean>(false);

	const [saving, setSaving] = useState<boolean>(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	// Flips true the first time the user attempts a save while a blocker is
	// still unmet. Until then, unmet requirements read as calm guidance
	// (faded-sumi); after a blocked attempt they escalate to error tone. Reset
	// on the next field edit so the form returns to calm once the user
	// re-engages — the same "status reflects current truth" pattern used below.
	const [attemptedSave, setAttemptedSave] = useState<boolean>(false);
	// Flips true on the first user edit (all field/sentence/kanji changes route
	// through updateField). Drives the unsaved-changes guard below.
	const [dirty, setDirty] = useState<boolean>(false);

	// ── Derived ───────────────────────────────────────────────────────────
	const previewCard = useMemo(() => buildPreviewCard(fields, card.layoutType), [fields, card.layoutType]);

	// Preview pager: indexes the same non-empty sentences `buildFieldsData`
	// emits, so the pinned index lines up with the preview card's array.
	const sentenceCount = useMemo(
		() => fields.sentences.filter(s => s.ja.trim().length > 0).length,
		[fields.sentences],
	);
	const clampedPreviewIdx = sentenceCount > 0 ? Math.min(previewSentenceIdx, sentenceCount - 1) : 0;

	// Hard save gate: a card must keep a definition. (Deck placement is fixed
	// while editing — moving a card lives in the card menu, not here — so the
	// deck is shown as read-only context and never gates the save.)
	const blockers = useMemo<string[]>(() => {
		const list: string[] = [];
		if (fields.meaning.trim().length === 0)
			list.push("Keep a definition to save.");
		return list;
	}, [fields.meaning]);

	// The Save button stays clickable whenever the form isn't mid-flight, even
	// with blockers present: a disabled button can't explain itself, so a
	// blocked click is what surfaces the (now escalated) requirement copy.
	const busy = saving;

	// Warn before a hard navigation / tab close drops unsaved edits. Suppressed
	// while a save is in flight (on success the page navigates away and unmounts
	// this guard). Soft in-app navigation isn't guarded (App Router limitation).
	useUnsavedChangesWarning(dirty && !saving);

	const updateField = useCallback(
		<K extends keyof CardFields>(key: K, value: CardFields[K]): void => {
			setDirty(true);
			setFields(prev => ({ ...prev, [key]: value }));
			// Re-engaging clears a prior blocked-save escalation, so unmet
			// requirements fall back to calm guidance rather than staying red.
			setAttemptedSave(prev => (prev ? false : prev));
		},
		[],
	);

	// ── Regenerate ────────────────────────────────────────────────────────
	//
	// The card is saved, so regeneration routes through the cheaper cardId-keyed
	// endpoints (`generateSentencesAction`, `generateMnemonicAction`) which look
	// the card up server-side to extract `word` and context.

	// Snapshot of the current non-empty Japanese lines. Sent as `avoid` so the
	// server prompts for fresh, distinct sentences (and caches per-context), and
	// reused to dedupe what comes back.
	const existingJa = useCallback(
		(): string[] => fields.sentences.map(s => s.ja.trim()).filter(s => s.length > 0),
		[fields.sentences],
	);

	// Generate a batch in one call and append the new, deduped sentences (up to
	// the cap), keyed by the saved card.
	const onGenerateExamples = useCallback((): void => {
		if (generatingBatch)
			return;
		const remaining = MAX_SENTENCES - fields.sentences.length;
		if (remaining <= 0)
			return;

		const want = Math.min(SENTENCE_BATCH, remaining);
		const avoid = existingJa();
		setGeneratingBatch(true); setPendingCount(want); setAiError(null);

		void generateSentencesAction(card.id, want, avoid)
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
			.catch(() => setAiError("Couldn't generate sentences. Please try again."))
			.finally(() => { setGeneratingBatch(false); setPendingCount(0); });
	}, [generatingBatch, fields.sentences, existingJa, card.id]);

	// Replace a single sentence in place with a fresh AI generation, telling the
	// model to avoid every current sentence so it doesn't echo what's there.
	const onRegenerateRow = useCallback((id: string): void => {
		if (regeneratingId !== null)
			return;

		const avoid = existingJa();
		setRegeneratingId(id); setAiError(null);

		void generateSentencesAction(card.id, 1, avoid)
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
			.catch(() => setAiError("Couldn't regenerate that sentence. Please try again."))
			.finally(() => setRegeneratingId(null));
	}, [regeneratingId, existingJa, card.id]);

	const onRegenMnemonic = useCallback((): void => {
		if (regenMnemonic)
			return;
		setRegenMnemonic(true); setAiError(null);

		void generateMnemonicAction(card.id)
			.then((data) => {
				if (data.mnemonic.length > 0) {
					setFields(prev => ({ ...prev, mnemonic: data.mnemonic }));
				}
			})
			.catch(() => setAiError("Couldn't regenerate the mnemonic. Please try again."))
			.finally(() => setRegenMnemonic(false));
	}, [regenMnemonic, card.id]);

	// ── Save / cancel ───────────────────────────────────────────────────────
	//
	// A blocked attempt (missing definition) flips `attemptedSave` so the
	// requirement copy escalates from calm guidance to error tone, then bails. A
	// clean attempt PATCHes via updateCardAction (If-Match: card.version for
	// optimistic concurrency) and returns to the page the user came from.
	// router.back() is a no-op when there's no in-app history (deep-link entry,
	// reload). Fall back to the card detail so Save/Cancel always lands somewhere.
	const goBackOrDetail = useCallback((): void => {
		if (typeof window !== "undefined" && window.history.length > 1)
			router.back();
		else router.push(`/cards/${card.id}`);
	}, [router, card.id]);

	const onSave = useCallback(async (): Promise<void> => {
		if (saving)
			return;
		if (blockers.length > 0) { setAttemptedSave(true); return; }
		setSaving(true); setSaveError(null);
		try {
			await updateCardAction(card.id, card.version, {
				fieldsData: buildFieldsData(fields),
				layoutType: card.layoutType,
				jlptLevel: fields.jlptLevel === "" ? null : fields.jlptLevel,
			});
			// Deck change rides a separate endpoint (POST /cards/:id/move), not the
			// content PATCH. It runs *after* the PATCH on purpose: the move bumps the
			// row version, so moving first would make the PATCH's If-Match stale and
			// 412. Move is version-agnostic (idempotency-key only), so this order is
			// safe. If the move fails, the content edit is already persisted and the
			// error surfaces for a retry — no edits are lost.
			if (fields.deckId !== "" && fields.deckId !== card.deckId) {
				await moveCardAction(card.id, fields.deckId);
			}
			// The destination (card detail / cards browser) is server-rendered and
			// sits in Next's client Router Cache. `cache: 'no-store'` only governs
			// the server-side fetch — without invalidating the Router Cache, back()
			// replays the pre-edit render and the save looks like a no-op. Refresh
			// first so the cache is stale before the back-navigation resolves it.
			router.refresh();
			goBackOrDetail();
		} catch {
			setSaveError("Couldn't save your changes. Please try again.");
			setSaving(false);
		}
		// No finally → setSaving(false): on success we navigate away, so leaving
		// the button in its loading state avoids a flash of the enabled form
		// during the route transition.
	}, [saving, blockers, fields, card.id, card.version, card.deckId, card.layoutType, router, goBackOrDetail]);

	const onCancel = useCallback((): void => {
		if (saving)
			return;
		goBackOrDetail();
	}, [saving, goBackOrDetail]);

	useEffect(() => {
		function handler(e: KeyboardEvent): void {
			if (!(e.metaKey || e.ctrlKey))
				return;
			if (e.key !== "Enter")
				return;
			e.preventDefault();
			void onSave();
		}
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onSave]);

	// ── Render ──────────────────────────────────────────────────────────────
	const header = {
		kanji: "筆",
		label: "Edit card",
		title: "Update what’s here.",
		subtitle: "Change anything below. Your edits replace the current card content when you save.",
	};

	return (
		<Frame>
			<PageHeader kanji={header.kanji} label={header.label} title={header.title} subtitle={header.subtitle} />

			{/* Two-column desktop (6/6): field SectionCards left, preview + Save right.
          items-start at every breakpoint: below lg the single-column grid would
          otherwise stretch the left-column track to its (definite) height, and the
          left column's h-full SectionCards would split that into equal slabs and
          clip taller sections via SectionCard's overflow-hidden. grid-cols-1 at
          the base breakpoint stops the implicit auto column from growing to a
          textarea's intrinsic min-content width and pushing the column past the
          viewport when an editor section expands. */}
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10">
				{/* Left: field SectionCards */}
				<div className="lg:col-span-6 flex flex-col gap-6 lg:gap-7">
					<DeckPickerCard
						decks={decks}
						value={fields.deckId}
						currentDeckId={card.deckId ?? ""}
						deckName={deckName}
						onChange={v => updateField("deckId", v)}
					/>

					<SectionCard kanji="義" label="Definition" rightContent={<SectionRequirement />}>
						<div className="flex flex-col gap-6 pt-1">
							<Textarea
								label="Meaning"
								value={fields.meaning}
								onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateField("meaning", e.target.value)}
								placeholder="e.g. dappled sunlight filtering through leaves"
								rows={2}
								block
								hint="The English meaning the card teaches."
							/>
							<div className="flex flex-col gap-2">
								<span id="pos-label" className="text-sm font-medium text-sumi-ink/85">
									Part of speech
									{" "}
									<span className="font-normal text-faded-sumi">· Optional</span>
								</span>
								<TomoSelect<string>
									value={fields.partOfSpeech}
									options={POS_OPTIONS}
									onValueChange={v => updateField("partOfSpeech", v)}
									ariaLabelledBy="pos-label"
								/>
							</div>
						</div>
					</SectionCard>

					<CollapsibleSection
						kanji="例"
						label="Example sentences"
						description="The learner sees one per review, rotated across your set."
						{...(fields.sentences.length > 0 ? { count: fields.sentences.length } : {})}
					>
						<div className="flex flex-col gap-6 pt-1">
							<SentenceEditor
								entries={fields.sentences}
								word={fields.word}
								onChange={next => updateField("sentences", next)}
								regeneratingId={regeneratingId}
								pendingCount={pendingCount}
								{...(aiEnabled ? { onRegenerateRow } : {})}
							/>
							{aiEnabled && fields.sentences.length < MAX_SENTENCES && (
								<div>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={onGenerateExamples}
										loading={generatingBatch}
										leadingIcon={<IconEdit className="h-4 w-4" />}
										aria-label="Generate example sentences"
									>
										{generatingBatch ? "Generating…" : `Generate ${Math.min(SENTENCE_BATCH, MAX_SENTENCES - fields.sentences.length)} examples`}
									</Button>
								</div>
							)}
						</div>
					</CollapsibleSection>

					<CollapsibleSection
						kanji="音"
						label="Pronunciation"
						description="Reading in kana, plus pitch accent for how the word sounds."
						hasContent={fields.reading.trim().length > 0 || fields.pitchAccent.trim().length > 0 || fields.pitchPosition.trim().length > 0}
					>
						<div className="grid gap-6 pt-1 sm:grid-cols-2">
							<Input
								label="Reading"
								value={fields.reading}
								onChange={e => updateField("reading", e.target.value)}
								placeholder="こもれび"
								script="kana"
							/>
							<div className="flex flex-col gap-2">
								<span id="pitch-label" className="text-sm font-medium text-sumi-ink/85">Pitch accent</span>
								<TomoSelect<string>
									value={fields.pitchAccent}
									options={PITCH_OPTIONS}
									onValueChange={v => updateField("pitchAccent", v)}
									ariaLabelledBy="pitch-label"
								/>
							</div>
							<Input
								label="Pitch position"
								value={fields.pitchPosition}
								onChange={e => updateField("pitchPosition", e.target.value)}
								placeholder="e.g. 0, 1, 3"
								inputMode="numeric"
							/>
						</div>
					</CollapsibleSection>

					<CollapsibleSection
						kanji="解"
						label="Teaching notes"
						description="Usage nuance and a memory aid, shown on the back of the card."
						hasContent={fields.nuance.trim().length > 0 || fields.mnemonic.trim().length > 0}
					>
						<div className="flex flex-col gap-6 pt-1">
							<Textarea
								label="Nuance"
								value={fields.nuance}
								onChange={e => updateField("nuance", e.target.value)}
								placeholder="Register, connotation, when to use it instead of a near-synonym."
								rows={3}
								block
								hint="Optional. Shown as the leading tab on the back of the card."
							/>
							<Textarea
								label="Mnemonic"
								value={fields.mnemonic}
								onChange={e => updateField("mnemonic", e.target.value)}
								placeholder="A small story or image that anchors the meaning."
								rows={3}
								block
								hint="Optional. A memory aid shown on the back of the card."
							/>
							{aiEnabled && (
								<div>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={onRegenMnemonic}
										loading={regenMnemonic}
										leadingIcon={<IconEdit className="h-4 w-4" />}
										aria-label="Generate a new mnemonic"
									>
										{regenMnemonic ? "Generating…" : "Try another mnemonic"}
									</Button>
								</div>
							)}
						</div>
					</CollapsibleSection>

					<CollapsibleSection
						kanji="字"
						label="Kanji breakdown"
						description="Split the word into its kanji, each with a meaning and reading."
						{...(fields.kanjiBreakdown.length > 0 ? { count: fields.kanjiBreakdown.length } : {})}
					>
						<KanjiEditor
							entries={fields.kanjiBreakdown}
							onChange={next => updateField("kanjiBreakdown", next)}
						/>
					</CollapsibleSection>

					<CollapsibleSection
						kanji="他"
						label="Advanced"
						description="Frequency rank and JLPT level."
						hasContent={fields.frequencyRank.trim().length > 0 || fields.jlptLevel !== ""}
					>
						<div className="grid gap-6 pt-1 sm:grid-cols-2">
							<Input
								label="Frequency rank"
								value={fields.frequencyRank}
								onChange={e => updateField("frequencyRank", e.target.value)}
								placeholder="e.g. 2400"
								inputMode="numeric"
							/>
							<div className="flex flex-col gap-2">
								<span id="jlpt-label" className="text-sm font-medium text-sumi-ink/85">JLPT level</span>
								<TomoSelect<string>
									value={fields.jlptLevel}
									options={JLPT_OPTIONS}
									onValueChange={v => updateField("jlptLevel", (v === "" ? "" : v) as JLPTLevel | "")}
									ariaLabelledBy="jlpt-label"
								/>
							</div>
						</div>
					</CollapsibleSection>
				</div>

				{/* Right column. Sticks to the top of the scroll area (<main>) while
            the field column scrolls, so the preview and Save pin flush with the
            top of the form rather than drifting. */}
				<aside className="flex flex-col gap-6 lg:col-span-6 lg:sticky lg:top-12 lg:self-start">
					<PreviewBlock
						card={previewCard}
						flipped={flipped}
						onFlip={() => setFlipped(f => !f)}
						aiError={aiError}
						sentenceCount={sentenceCount}
						sentenceIndex={clampedPreviewIdx}
						onPrevSentence={() => setPreviewSentenceIdx(i => Math.max(0, i - 1))}
						onNextSentence={() => setPreviewSentenceIdx(i => Math.min(sentenceCount - 1, i + 1))}
					/>
					<SaveBlock
						saving={saving}
						busy={busy}
						blockers={blockers}
						attemptedSave={attemptedSave}
						saveError={saveError}
						onSave={onSave}
						onCancel={onCancel}
					/>
				</aside>
			</div>
		</Frame>
	);
}
