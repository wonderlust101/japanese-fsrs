"use client";

import type { JLPTLevel } from "@fsrs-japanese/shared-types";
import type { ChangeEvent } from "react";
import type { CardFields, SentenceEntry } from "./card-editor-fields";
import type { TomoSelectOption } from "@/components/ui/TomoSelect";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,

} from "react";

import { MobileStickyActionBar } from "@/app/(app)/_components/mobile-sticky-action-bar";

import { PageFrame } from "@/app/(app)/_components/page-frame";
import { KanjiEditor } from "@/components/card-editor/KanjiEditor";
import { SentenceEditor } from "@/components/card-editor/SentenceEditor";
import { IconEdit } from "@/components/icons/chrome-marks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { PageLoader } from "@/components/ui/TomoLoader";
import { TomoSelect } from "@/components/ui/TomoSelect";
import { useAddReviewDevState } from "@/dev/panels/add-review";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import {
	generateCardPreviewAction,
	generateSentencesByWordAction,
	saveCardAction,
} from "@/lib/actions/cards.actions";
import { useDecks } from "@/lib/api/decks";
import { queryKeys } from "@/lib/api/queryKeys";
import {
	useCaptureDraftActions,
	useCaptureDraftStore,
} from "@/stores/useCaptureDraftStore";
import { buildFieldsData, buildPreviewCard, JLPT_OPTIONS, makeEmptyFields, MAX_SENTENCES, nextRowKey, PITCH_OPTIONS, POS_OPTIONS, SENTENCE_BATCH } from "./card-editor-fields";
import { CollapsibleSection, DeckCard, Frame, PreviewBlock, SaveBlock, SectionRequirement, SuccessBlock } from "./card-editor-sections";

// ── Page ──────────────────────────────────────────────────────────────────────

export function GeneratedReviewClient(): React.JSX.Element {
	useAddReviewDevState();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [, startNav] = useTransition();
	const draft = useCaptureDraftStore(s => s.draft);
	const captureActions = useCaptureDraftActions();

	const noDraft = draft.word.trim().length === 0;
	// Tracked via a ref so the redirect effect doesn't have to depend on the
	// `saved` state (declared further down) and re-run when it changes. Once
	// we've saved, the draft is intentionally empty (captureActions.reset()
	// at save time) — the redirect would bounce the user off the success
	// screen they just earned, so it must not fire post-save.
	const hasSavedRef = useRef<boolean>(false);
	useEffect(() => {
		if (!noDraft)
			return;
		if (hasSavedRef.current)
			return;
		router.replace("/add");
	}, [noDraft, router]);

	// ── Live state ────────────────────────────────────────────────────────
	const [fields, setFields] = useState<CardFields>(() => ({
		...makeEmptyFields(),
		word: draft.word,
		reading: draft.reading,
		meaning: draft.meaning,
		mnemonic: draft.mnemonic,
		sentences: draft.sentence.trim().length > 0
			? [{ id: nextRowKey(), ja: draft.sentence, en: "", furigana: "" }]
			: [],
		picture: draft.imageDataUrl,
	}));
	const [deckId, setDeckId] = useState<string | null>(draft.deckId);
	const [flipped, setFlipped] = useState<boolean>(false);
	// Which example sentence the preview pins (the review back rotates; the
	// author pages through them here). Clamped against the live count at render.
	const [previewSentenceIdx, setPreviewSentenceIdx] = useState<number>(0);

	const isAiPath = draft.mode === "generate";
	const needsSeed = isAiPath && draft.reading === "";
	const [generating, setGenerating] = useState<boolean>(needsSeed);
	const [aiError, setAiError] = useState<string | null>(null);
	// Batch sentence generation: `pendingCount` drives the skeleton placeholder
	// rows so the author sees how many sentences are inbound.
	const [generatingBatch, setGeneratingBatch] = useState<boolean>(false);
	const [pendingCount, setPendingCount] = useState<number>(0);
	// Id of the single row being regenerated in place (null = none).
	const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
	const [regenMnemonic, setRegenMnemonic] = useState<boolean>(false);

	// The save flow as one discriminated union: impossible combinations (saving
	// *and* saved, or error *and* saving) are unrepresentable, and each terminal
	// state carries exactly the data it needs.
	type SaveState
		= | { status: "idle" }
			| { status: "saving" }
			| { status: "error"; message: string }
			| { status: "saved"; count: number; deckName: string };
	const [save, setSave] = useState<SaveState>({ status: "idle" });
	// Flips true the first time the user attempts a save while a blocker is
	// still unmet. Until then, unmet requirements read as calm guidance
	// (faded-sumi); after a blocked attempt they escalate to error tone. Reset
	// on the next field/deck edit so the form returns to calm once the user
	// re-engages — the same "status reflects current truth" pattern used below.
	const [attemptedSave, setAttemptedSave] = useState<boolean>(false);
	// Flips true on the first user edit (any field, sentence, or kanji change all
	// route through updateField). Drives the unsaved-changes guard below. The AI
	// seed/batch/regen paths write fields directly, not via updateField, so a
	// freshly-generated but untouched card never trips the warning.
	const [dirty, setDirty] = useState<boolean>(false);

	// ── Decks ─────────────────────────────────────────────────────────────
	const decksQuery = useDecks(50);
	const deckOptions = useMemo<ReadonlyArray<TomoSelectOption<string>>>(() => {
		const items = decksQuery.data?.items ?? [];
		return items.map(d => ({
			value: d.id,
			label: d.name.trim().length > 0 ? d.name : "Untitled deck",
		}));
	}, [decksQuery.data]);

	const deckName = useMemo(() => {
		if (deckId === null)
			return null;
		const match = decksQuery.data?.items.find(d => d.id === deckId);
		return match?.name ?? null;
	}, [deckId, decksQuery.data]);

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
		void generateCardPreviewAction(draft.word.trim())
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
	}, []);

	// ── Derived ───────────────────────────────────────────────────────────
	const previewCard = useMemo(() => buildPreviewCard(fields), [fields]);

	// Preview pager: indexes the same non-empty sentences `buildFieldsData`
	// emits, so the pinned index lines up with the preview card's array.
	const sentenceCount = useMemo(
		() => fields.sentences.filter(s => s.ja.trim().length > 0).length,
		[fields.sentences],
	);
	const clampedPreviewIdx = sentenceCount > 0 ? Math.min(previewSentenceIdx, sentenceCount - 1) : 0;

	// Hard save gates only: a definition and a deck. The "sentence doesn't
	// include the word" check moved to a per-sentence inline warning (see
	// SentenceEditor) — with conjugation and multiple sentences a hard block
	// would be hostile, so it informs rather than prevents.
	const blockers = useMemo<string[]>(() => {
		const list: string[] = [];
		if (fields.meaning.trim().length === 0)
			list.push("Add a definition to save.");
		if (deckId === null)
			list.push("Pick a deck to save into.");
		return list;
	}, [fields.meaning, deckId]);

	// The Save button stays clickable whenever the form isn't mid-flight, even
	// with blockers present: a disabled button can't explain itself, so a
	// blocked click is what surfaces the (now escalated) requirement copy.
	const busy = generating || save.status === "saving";

	// Warn before a hard navigation / tab close drops unsaved edits. Suppressed
	// once a save is in flight or has landed (the success screen then replaces
	// the form). Soft in-app navigation isn't guarded (App Router limitation).
	useUnsavedChangesWarning(dirty && save.status !== "saving" && save.status !== "saved");

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

	const onDeckChange = useCallback((next: string): void => {
		setDeckId(next);
		setAttemptedSave(prev => (prev ? false : prev));
	}, []);

	// ── Regenerate ────────────────────────────────────────────────────────
	//
	// All regeneration runs pre-save: no card exists yet, so the dedicated
	// cardId endpoints can't help (they look the card up server-side to extract
	// `word`). Sentences route through `generateSentencesByWordAction`; the
	// mnemonic re-runs the full preview generator and slices the field. Once the
	// card is saved the form is replaced by the success screen, so there is no
	// post-save regeneration path to feed.

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
	}, [generatingBatch, generating, fields.word, fields.sentences, existingJa]);

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
	}, [regeneratingId, generating, fields.word, existingJa]);

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
	}, [fields.word, regenMnemonic, generating]);

	// ── Save ──────────────────────────────────────────────────────────────
	//
	// A blocked attempt (missing definition or deck) flips `attemptedSave` so the
	// requirement copy escalates from calm guidance to error tone, then bails. A
	// clean attempt POSTs via saveCardAction and shows the success screen.
	const onSave = useCallback(async (): Promise<void> => {
		if (save.status === "saving" || generating)
			return;
		if (blockers.length > 0) { setAttemptedSave(true); return; }
		if (deckId === null)
			return;
		setSave({ status: "saving" });
		try {
			await saveCardAction(deckId, {
				mode: "manual",
				fieldsData: buildFieldsData(fields),
				layoutType: "vocabulary",
				...(fields.jlptLevel !== "" ? { jlptLevel: fields.jlptLevel } : {}),
			});
			// The new card enters the New pool. Refresh the review queue (due +
			// forecast) and the cards/decks rollups so it surfaces immediately on
			// /today and /review instead of waiting for the queries to go stale.
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() });
			// Flip *before* resetting the draft so the noDraft → redirect effect
			// sees `hasSavedRef.current === true` on the very next render (refs are
			// synchronous; state is not).
			hasSavedRef.current = true;
			captureActions.reset();
			setSave({ status: "saved", count: 1, deckName: deckName ?? "your deck" });
		} catch (err: unknown) {
			// 'saved' and 'error' are both terminal (not 'saving'), so no finally
			// is needed to clear an in-flight flag — the union does that by shape.
			setSave({ status: "error", message: err instanceof Error ? err.message : "Could not save the card." });
		}
	}, [save.status, generating, blockers, deckId, fields, deckName, captureActions, queryClient]);

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

	// ── Renders ───────────────────────────────────────────────────────────
	// Only short-circuit on noDraft *before* a save has happened. After save,
	// captureActions.reset() empties the draft intentionally — letting the
	// loading stub steal the render would hide the SuccessBlock entirely.
	if (noDraft && save.status !== "saved") {
		return (
			<PageLoader
				stageLabels={[
					"Reading the word…",
					"Drafting reading and meaning…",
					"Writing an example sentence…",
					"Polishing the mnemonic…",
				]}
			/>
		);
	}

	// While the AI is generating the card preview (the user has a word but
	// not yet a populated draft), hold the form behind the page loader with
	// rotating stage labels so the 2–10s wait reads as deliberate work.
	if (generating) {
		return (
			<PageLoader
				stageLabels={[
					"Reading the word…",
					"Drafting reading and meaning…",
					"Writing an example sentence…",
					"Polishing the mnemonic…",
				]}
			/>
		);
	}

	// SuccessBlock is the terminal celebratory state once a card is saved.
	if (save.status === "saved") {
		return (
		// Short closure screen: vertically centered (desktopCentered) rather
		// than top-anchored like the long form.
			<PageFrame desktopCentered>
				<SuccessBlock
					count={save.count}
					deckName={save.deckName}
					onAddAnother={() => startNav(() => router.push("/add"))}
					onReturnToToday={() => startNav(() => router.push("/today"))}
				/>
			</PageFrame>
		);
	}

	const header = isAiPath
		? {
				kanji: "校",
				label: "Review prepared card",
				title: "Confirm what’s right.",
				subtitle: "Tomo drafted this from the word and sentence you chose. Fix anything that’s off.",
			}
		: {
				kanji: "確",
				label: "Confirm your card",
				title: "Fill in the back.",
				subtitle: "Add the details a learner will see after they flip during practice.",
			};

	return (
		<Frame>
			<PageHeader kanji={header.kanji} label={header.label} title={header.title} subtitle={header.subtitle} />

			{/* Two-column desktop (6/6): field SectionCards left, preview + Save right.
          items-start at every breakpoint: below lg this is a single-column grid
          whose default align-items:stretch would stretch the left-column track
          to the grid's (definite, flex-1-derived) height. The left column is a
          flex-col of h-full SectionCards, so that stretch splits into equal-height
          slabs and SectionCard's overflow-hidden clips the taller sections. Pin
          items to start so each card keeps its content height.
          grid-cols-1 (minmax(0,1fr)) at the base breakpoint is load-bearing too:
          without it, below lg the grid has no column template and falls back to
          an implicit auto track that grows to its content's min-content width. A
          textarea's intrinsic min-content (its default cols) then drags the
          column past the viewport when the Example sentences editor expands. The
          explicit 1fr track refuses to grow past the container. */}
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10">
				{/* Left: field SectionCards. lg:order-first reasserts source order on
            desktop; on mobile the aside below claims order-first so the card the
            user is confirming leads the page instead of trailing six form
            sections. */}
				<div className="lg:order-first lg:col-span-6 flex flex-col gap-6 lg:gap-7">
					<DeckCard
						options={deckOptions}
						value={deckId}
						onChange={onDeckChange}
						loading={decksQuery.isLoading}
						deckName={deckName}
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
								{...(isAiPath ? { onRegenerateRow } : {})}
							/>
							{isAiPath && fields.sentences.length < MAX_SENTENCES && (
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
							{isAiPath && (
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

				{/* Right column. On mobile this leads the page (order-first) so the
            card being confirmed is the first thing seen; the form sections and a
            sticky bottom Save bar follow. At lg it reverts to the right rail and
            sticks to the top of the scroll area (<main>) while the field column
            scrolls:
              - top-12 (3rem) matches PageFrame's lg top padding, so the pinned
                preview lines up with where the field column begins.
              - self-start keeps the aside content-height so the sticky offset
                applies inside the taller field-column grid row.
            No max-height / internal scroll: the aside is its natural height so
            it never shows its own scrollbar over the preview. */}
				<aside className="order-first lg:order-none flex flex-col gap-6 lg:col-span-6 lg:sticky lg:top-12 lg:self-start">
					<PreviewBlock
						card={previewCard}
						flipped={flipped}
						onFlip={() => setFlipped(f => !f)}
						loading={generating}
						aiError={aiError}
						sentenceCount={sentenceCount}
						sentenceIndex={clampedPreviewIdx}
						onPrevSentence={() => setPreviewSentenceIdx(i => Math.max(0, i - 1))}
						onNextSentence={() => setPreviewSentenceIdx(i => Math.min(sentenceCount - 1, i + 1))}
					/>
					{/* Desktop Save lives under the sticky preview. On mobile it's hidden
              here and re-homed to the bottom sticky bar so it stays in reach
              without scrolling the full form. */}
					<div className="hidden lg:block">
						<SaveBlock
							saving={save.status === "saving"}
							busy={busy}
							blockers={blockers}
							attemptedSave={attemptedSave}
							saveError={save.status === "error" ? save.message : null}
							onSave={onSave}
						/>
					</div>
				</aside>
			</div>

			{/* Mobile-only: the primary action pinned to the bottom of the viewport,
          so Save is always one tap away regardless of scroll position. Hidden
          at lg, where the Save block rides the sticky preview column instead. */}
			<MobileStickyActionBar ariaLabel="Save card">
				<SaveBlock
					saving={save.status === "saving"}
					busy={busy}
					blockers={blockers}
					attemptedSave={attemptedSave}
					saveError={save.status === "error" ? save.message : null}
					onSave={onSave}
				/>
			</MobileStickyActionBar>
		</Frame>
	);
}
