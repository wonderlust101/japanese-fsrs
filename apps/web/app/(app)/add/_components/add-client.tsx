"use client";

import type { ApiDeck } from "@fsrs-japanese/shared-types";
import type { ChangeEvent } from "react";

import type { TomoSelectOption } from "@/components/ui/TomoSelect";
import type { CaptureDraft, CaptureMode } from "@/stores/useCaptureDraftStore";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	useTransition,

} from "react";
import { MobileStickyActionBar } from "@/app/(app)/_components/mobile-sticky-action-bar";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { CreateDeckDialog } from "@/app/(app)/decks/_components/create-deck-dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuietLink } from "@/components/ui/QuietLink";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { PageLoader } from "@/components/ui/TomoLoader";
import { TomoSelect } from "@/components/ui/TomoSelect";
import { useAddDevState } from "@/dev/panels/add";
import { useRevealMount } from "@/hooks/use-reveal-mount";
import { useDecks } from "@/lib/api/decks";
import {
	useCaptureDraftActions,

} from "@/stores/useCaptureDraftStore";

import { AddSessionPreview, isTargetMissingFromSentence } from "./add-session-preview";

// ── Errors ────────────────────────────────────────────────────────────────────
//
// Validation runs on submit (either Generate or Manual). Missing required
// fields are surfaced inline below their field. Editing a field clears its
// error so the user gets responsive feedback as they fix the form.

interface FormErrors {
	word: string | null;
	deck: string | null;
}

const NO_ERRORS: FormErrors = { word: null, deck: null };

// ── Add client ────────────────────────────────────────────────────────────────

interface AddClientProps {
	/** Stable date key (yyyy-mm-dd) for seeding the preview empty-state quote. */
	todayKey: string;
}

export function AddClient({ todayKey }: AddClientProps): React.JSX.Element {
	useAddDevState();
	const router = useRouter();
	const [, startNav] = useTransition();
	const captureActions = useCaptureDraftActions();

	// Page-level reveal (mount mode). A single beat: the PageHeader lead + the
	// capture SectionCard chrome. The form FIELDS inside are not individually
	// revealed (spec §P2.6); the preview aside stays static. Re-runs once the
	// form branch mounts (after the decks loader).
	const contentRef = useRef<HTMLDivElement | null>(null);

	// ── Required fields ─────────────────────────────────────────────────────
	const [word, setWord] = useState<string>("");
	const [sentence, setSentence] = useState<string>("");
	const [deckId, setDeckId] = useState<string | null>(null);

	// ── UX state ────────────────────────────────────────────────────────────
	const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
	const [submitting, setSubmitting] = useState<boolean>(false);
	const [submitMode, setSubmitMode] = useState<CaptureMode | null>(null);

	// Ref + the pointer-gated autofocus effect live further down, after the
	// decks query is in scope: the form (and this input) only mounts once
	// `decksQuery.isLoading` is false, so the focus must wait for that.
	const wordInputRef = useRef<HTMLInputElement>(null);

	// ── Derived ─────────────────────────────────────────────────────────────
	const trimmedWord = word.trim();
	const trimmedSentence = sentence.trim();
	const targetMissing = isTargetMissingFromSentence(trimmedWord, trimmedSentence);

	// ── Decks ───────────────────────────────────────────────────────────────
	const decksQuery = useDecks(50);

	// Whether the full "New deck" dialog is open. The dialog (shared with the
	// decks page) collects name + description + type so the user can build a
	// complete deck without leaving /add.
	const [createDeckOpen, setCreateDeckOpen] = useState<boolean>(false);

	// Decks created via the dialog this session. Held locally and merged into
	// the options so a freshly-created deck is selectable *immediately* —
	// before the invalidated `decks.list` query has finished refetching —
	// which avoids a flash where the just-selected deck has no matching
	// option. Deduped against the server list by id once the refetch lands.
	const [createdDecks, setCreatedDecks] = useState<ApiDeck[]>([]);

	const deckOptions = useMemo<ReadonlyArray<TomoSelectOption<string>>>(() => {
		const items = [...(decksQuery.data?.items ?? [])];
		for (const d of createdDecks) {
			if (!items.some(existing => existing.id === d.id))
				items.push(d);
		}
		return items.map(d => ({
			value: d.id,
			label: d.name.trim().length > 0 ? d.name : "Untitled deck",
		}));
	}, [decksQuery.data, createdDecks]);

	const noDecks = !decksQuery.isLoading && deckOptions.length === 0;

	// Called by the dialog on a successful create: merge the new deck into the
	// options and select it, clearing any "pick a deck" error.
	const handleDeckCreated = useCallback((deck: ApiDeck): void => {
		setCreatedDecks(prev => [...prev, deck]);
		setDeckId(deck.id);
		setErrors(prev => (prev.deck === null ? prev : { ...prev, deck: null }));
	}, []);

	// ── Capture-first autofocus, pointer devices only ────────────────────────
	// Focusing the Word field on load speeds desktop capture, but on touch it
	// ambushes the calm landing by raising the keyboard and scrolling the
	// header away. Gate on `(pointer: fine)` so phones/tablets keep the header
	// in view. The form only mounts once decks finish loading (the component
	// early-returns a loader before then), so wait for that and fire once.
	// Client-only effect, so there's no SSR/hydration focus mismatch.
	const hasAutofocusedRef = useRef<boolean>(false);
	useEffect(() => {
		if (decksQuery.isLoading || hasAutofocusedRef.current)
			return;
		if (!window.matchMedia("(pointer: fine)").matches)
			return;
		hasAutofocusedRef.current = true;
		wordInputRef.current?.focus();
	}, [decksQuery.isLoading]);

	// ── Field setters that also clear their error ───────────────────────────
	const updateWord = useCallback((next: string): void => {
		setWord(next);
		setErrors(prev => (prev.word === null ? prev : { ...prev, word: null }));
	}, []);

	const updateSentence = useCallback((next: string): void => {
		setSentence(next);
	}, []);

	const updateDeck = useCallback((next: string): void => {
		setDeckId(next);
		setErrors(prev => (prev.deck === null ? prev : { ...prev, deck: null }));
	}, []);

	// ── Validate + submit ───────────────────────────────────────────────────
	const validate = useCallback((): FormErrors => {
		return {
			word: trimmedWord.length === 0 ? "Add a word or phrase." : null,
			deck: deckId === null ? "Pick a deck to save into." : null,
		};
	}, [trimmedWord, deckId]);

	const submit = useCallback((mode: CaptureMode) => {
		if (submitting)
			return;
		const next = validate();
		// The word gates everything; surface its error first (also the Enter-key
		// path, which can fire with an empty word even though the buttons gate on it).
		if (next.word !== null) {
			setErrors({ ...next, deck: null });
			return;
		}
		// Deckless: there's no deck to pick, so the "pick a deck" error would be a
		// dead end. Open the create dialog instead. The word is valid here, so the
		// user lands in deck creation with their capture intact; on success the new
		// deck is auto-selected and they proceed with a second click.
		if (noDecks) {
			setCreateDeckOpen(true);
			return;
		}
		if (next.deck !== null) {
			setErrors(next);
			return;
		}
		setErrors(NO_ERRORS);

		const draft: CaptureDraft = {
			word: trimmedWord,
			sentence: trimmedSentence,
			mode,
			reading: "",
			meaning: "",
			mnemonic: "",
			note: "",
			deckId,
			source: "",
			imageName: null,
			imageDataUrl: null,
			updatedAt: Date.now(),
		};
		captureActions.setDraft(draft);

		// Only the Generate path actually does work downstream (AI call on
		// /add/review). Manual is a pure handoff to a blank edit form, so don't
		// simulate progress for it: just route. The loading state is reserved for
		// paths that legitimately take time.
		if (mode === "generate") {
			setSubmitMode("generate");
			setSubmitting(true);
		}

		startNav(() => router.push("/add/review"));
	}, [submitting, validate, noDecks, trimmedWord, trimmedSentence, deckId, captureActions, router]);

	const onGenerate = useCallback(() => submit("generate"), [submit]);
	const onManual = useCallback(() => submit("manual"), [submit]);

	const cancelSubmit = useCallback(() => {
		setSubmitting(false);
		setSubmitMode(null);
	}, []);

	// ── Action area (shared between desktop sibling and mobile bar) ─────────
	// Both required fields gate the actions: a word, and (when decks exist) a
	// chosen deck. The deckless path is the one exception — there's no deck to
	// pick, so the buttons stay enabled on the word alone and route through the
	// create-deck dialog instead of dead-ending on a requirement the user can't
	// satisfy here.
	const hasWord = trimmedWord.length > 0;
	const needsDeck = hasWord && deckId === null && !noDecks;
	const canProceed = hasWord && !needsDeck;
	// The status line names the load-bearing blocker once the word is in and
	// stays visible while the buttons are disabled, so the disabled state
	// explains itself. It yields to the localized field error after a submit
	// attempt (`errors.deck`) so the same sentence never shows in two places.
	const deckStatus = needsDeck && errors.deck === null
		? "Pick a deck to save into."
		: null;

	const actions = (
		<ActionArea
			submitting={submitting}
			activeMode={submitMode}
			canProceed={canProceed}
			statusLine={deckStatus}
			onGenerate={onGenerate}
			onManual={onManual}
			onCancel={cancelSubmit}
		/>
	);

	// Fire the reveal once the form (not the loader) is what renders.
	useRevealMount(contentRef, { deps: [decksQuery.isLoading] });

	// ── Render ──────────────────────────────────────────────────────────────
	if (decksQuery.isLoading) {
		return <PageLoader />;
	}

	return (
		<PageFrame desktopCentered contentRef={contentRef}>
			<PageHeader
				kanji="採"
				label="Capture"
				title="Save what you found."
				subtitle="Tomo adds context, you stay in the moment."
				revealLead
			/>

			{/* items-start so the single-column (below lg) grid doesn't stretch the
            form-column track to the grid height and clip h-full SectionCards via
            their overflow-hidden — and so the two desktop columns keep their own
            heights rather than equalizing. */}
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10">
				{/* Left: required form (back-of-card capture moved to /add/review) */}
				<div className="lg:col-span-6">
					<SectionCard
						id="add-form"
						kanji="記"
						label="Write it down"
						description="A word and a deck make a card."
						stripeTone="brand"
						reveal
					>
						<form
							className="flex flex-col gap-7 pt-1"
							onSubmit={(e) => {
								e.preventDefault();
								onGenerate();
							}}
							noValidate
						>
							<Input
								ref={wordInputRef}
								label="Word or phrase"
								value={word}
								onChange={(e: ChangeEvent<HTMLInputElement>) => updateWord(e.target.value)}
								placeholder="e.g. 木漏れ日"
								script="mixed"
								size="lg"
								autoComplete="off"
								spellCheck={false}
								error={errors.word ?? undefined}
							/>

							<Textarea
								label="Example sentence (optional)"
								value={sentence}
								onChange={e => updateSentence(e.target.value)}
								placeholder="今日は木漏れ日だから、人が少ない。"
								script="mixed"
								block
								rows={4}
								hint="Optional. A sentence where the word appears; you can also add one on the next step."
							/>

							<DeckField
								options={deckOptions}
								value={deckId}
								onChange={updateDeck}
								loading={decksQuery.isLoading}
								noDecks={noDecks}
								error={errors.deck}
								onRequestCreate={() => setCreateDeckOpen(true)}
							/>

							<button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
								Generate card
							</button>
						</form>
					</SectionCard>
				</div>

				{/* Right: session-faithful preview + sibling action block */}
				<aside className="lg:col-span-6 lg:sticky lg:top-10 lg:self-start flex flex-col gap-6">
					<div data-reveal="">
						<AddSessionPreview
							word={trimmedWord}
							sentence={trimmedSentence}
							todayKey={todayKey}
							dimmed={submitting}
							targetMissing={targetMissing}
						/>
					</div>

					<div className="hidden lg:block" data-reveal="">{actions}</div>
				</aside>
			</div>

			<MobileStickyActionBar ariaLabel="Create card">
				{actions}
			</MobileStickyActionBar>

			<CreateDeckDialog
				open={createDeckOpen}
				onClose={() => setCreateDeckOpen(false)}
				onCreated={handleDeckCreated}
			/>
		</PageFrame>
	);
}

// ── Deck field (uses TomoSelect to match the Settings dropdown register) ─────
//
// Picks an existing deck, or opens the shared "New deck" dialog so the user
// can build a full deck (name + description + type) without leaving /add.
// The dialog itself lives in the parent; this field just requests it via
// `onRequestCreate`.

interface DeckFieldProps {
	options: ReadonlyArray<TomoSelectOption<string>>;
	value: string | null;
	onChange: (next: string) => void;
	loading: boolean;
	noDecks: boolean;
	error: string | null;
	onRequestCreate: () => void;
}

function DeckField({
	options,
	value,
	onChange,
	loading,
	noDecks,
	error,
	onRequestCreate,
}: DeckFieldProps): React.JSX.Element {
	const id = useId();
	const labelId = `${id}-label`;
	const hintId = `${id}-hint`;
	const errId = `${id}-error`;

	const hint = loading
		? "Loading your decks…"
		: noDecks
			? undefined
			: "The card will live in this deck.";

	// Associate the select with whichever helper line is showing, mirroring the
	// `describedBy` logic in `Input`: the error wins when present, otherwise the
	// hint. Lets a screen reader read the guidance on focus, not only via the
	// `role="alert"` flash.
	const describedBy = error !== null
		? errId
		: hint !== undefined
			? hintId
			: undefined;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-3">
				<span id={labelId} className="text-sm font-medium text-sumi-ink/85">Deck</span>
				<QuietLink
					onClick={onRequestCreate}
					tone="brand"
					size="md"
					ariaLabel="Create a new deck"
				>
					+ New deck
				</QuietLink>
			</div>

			{!noDecks && (
				<TomoSelect<string>
					id={id}
					value={value ?? ""}
					options={options}
					onValueChange={onChange}
					ariaLabelledBy={labelId}
					ariaDescribedBy={describedBy}
					placeholder="Choose a deck…"
					disabled={loading}
				/>
			)}

			{error !== null
				? (
						<p id={errId} role="alert" className="text-sm text-error">
							{error}
						</p>
					)
				: noDecks
					? (
							<p className="text-sm text-faded-sumi">
								No decks yet. Your first one takes a moment, and your card lands right inside.
							</p>
						)
					: (
							hint !== undefined && (
								<p id={hintId} className="text-sm text-faded-sumi">{hint}</p>
							)
						)}
		</div>
	);
}

// ── Action area ──────────────────────────────────────────────────────────────

interface ActionAreaProps {
	submitting: boolean;
	activeMode: CaptureMode | null;
	/** A word is present, so the actions are allowed to fire. */
	canProceed: boolean;
	/** The single load-bearing blocker to show above the hero, or null. */
	statusLine: string | null;
	onGenerate: () => void;
	onManual: () => void;
	onCancel: () => void;
}

// One hero (Generate), one quiet escape hatch (manual). Generate is the path
// Tomo is built around: it drafts the back of the card. Manual hands the user
// a blank editor, so it reads as the deliberate, secondary choice beneath the
// hero rather than a co-equal button. Both gate on a word being present.
function ActionArea({
	submitting,
	activeMode,
	canProceed,
	statusLine,
	onGenerate,
	onManual,
	onCancel,
}: ActionAreaProps): React.JSX.Element {
	const generateDisabled = !canProceed || (submitting && activeMode !== "generate");

	return (
		<div className="flex flex-col gap-3">
			{statusLine !== null && (
				<p role="status" className="text-center font-mono text-xs text-faded-sumi">
					{statusLine}
				</p>
			)}

			<Button
				type="button"
				variant="primary"
				size="lg"
				onClick={onGenerate}
				disabled={generateDisabled}
				loading={submitting && activeMode === "generate"}
				className="w-full"
			>
				Generate card
			</Button>

			{/* The escape hatch and Cancel are exclusive in time: the manual offer
          before submit, Cancel while generating. Showing one keeps the row
          quiet at a waiting moment instead of pairing a dimmed link with Cancel. */}
			<div className="flex items-center justify-center">
				{submitting
					? (
							<QuietLink
								onClick={onCancel}
								tone="sumi"
								size="md"
								ariaLabel="Cancel card creation"
							>
								Cancel
							</QuietLink>
						)
					: (
							<QuietLink
								onClick={onManual}
								tone="sumi"
								size="md"
								disabled={!canProceed}
								ariaLabel="Skip AI and build the card yourself"
							>
								or build it yourself
							</QuietLink>
						)}
			</div>
		</div>
	);
}
