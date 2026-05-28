"use client";

// Form scaffolding for the edit-card editor: page frame, section requirement
// tag, collapsible optional section, deck picker, the live preview block +
// pager, and the save block. Lifted out of edit-card-client.tsx.

import type { ApiDueCard } from "@fsrs-japanese/shared-types";

import type { DeckOption } from "./card-editor-fields";

import type { TomoSelectOption } from "@/components/ui/TomoSelect";
import { useEffect, useState } from "react";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { IconChevronDown, IconUndo } from "@/components/icons/chrome-marks";
import { CardBack } from "@/components/review/session/CardBack";
import { CardFront } from "@/components/review/session/CardFront";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { TomoSelect } from "@/components/ui/TomoSelect";

import { cn } from "@/lib/utils";

// ── Frame ─────────────────────────────────────────────────────────────────────

export function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
	// Top-anchored (not desktopCentered): this is a long scrollable form, and
	// page-level vertical centering would fight the sticky preview column.
	return <PageFrame>{children}</PageFrame>;
}

// ── Section requirement tag ────────────────────────────────────────────────
//
// Quiet header marker stating whether a section gates saving. Only Definition
// is required here (deck placement is fixed while editing); everything else is
// optional. Rendered in the section header's rightContent slot so the contract
// is scannable down the long form without competing with the field labels.

export function SectionRequirement(): React.JSX.Element {
	return (
		<span className="font-mono text-xs uppercase tracking-[0.08em] text-faded-sumi">
			Required
		</span>
	);
}

// ── Collapsible optional section ────────────────────────────────────────────
//
// Wraps a SectionCard so an optional section can collapse to just its header,
// keeping the long form short. Collapsed by default. The header carries the
// persistent "Optional" classification plus a chevron toggle; when collapsed
// with content present, a `count` ("· N") or a filled dot signals that the
// section still holds data, so disclosure never hides it silently. Definition
// stays a plain (always-open) SectionCard — it gates saving.

interface CollapsibleSectionProps {
	kanji: string;
	label: string;
	description?: string;
	/** Shown as "· N" after the label (use for list sections like sentences). */
	count?: number;
	/** When no count applies, a filled dot signals the section has content. */
	hasContent?: boolean;
	children: React.ReactNode;
}

export function CollapsibleSection({
	kanji,
	label,
	description,
	count,
	hasContent = false,
	children,
}: CollapsibleSectionProps): React.JSX.Element {
	// Optional sections that already hold content open on mount while editing —
	// unlike /add/review (always collapsed) the author is here to revise what's
	// there, so surfacing populated sections saves a click per section.
	const initiallyOpen = count !== undefined ? count > 0 : hasContent;
	const [open, setOpen] = useState(initiallyOpen);
	const showDot = !open && count === undefined && hasContent;

	// WAI-ARIA accordion: the whole header is a button wrapped in an <h2>, so the
	// entire row toggles (a generous target) while the section title stays a real
	// heading. `omitTitle` skips SectionCard's own CardHeader so we own the
	// markup. Header typography mirrors CardHeader so these read identically to
	// the required Definition card above.
	return (
		<SectionCard kanji={kanji} label={label} omitTitle>
			<h2>
				<button
					type="button"
					onClick={() => setOpen(o => !o)}
					aria-expanded={open}
					className={cn(
						"flex w-full items-start gap-3 rounded-xs text-left",
						"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					)}
				>
					<span
						lang="ja"
						aria-hidden="true"
						className="shrink-0 translate-y-[0.05em] font-display text-xl leading-none text-inari-vermillion"
					>
						{kanji}
					</span>
					<span className="min-w-0 flex-1">
						<span className="flex flex-wrap items-baseline gap-x-2 font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80">
							{label}
							{count !== undefined && (
								<span className="text-faded-sumi">
									·
									{count}
								</span>
							)}
						</span>
						{description !== undefined && (
							<span className="mt-2 block max-w-measure text-sm leading-[1.55] text-faded-sumi">
								{description}
							</span>
						)}
					</span>
					<span className="flex shrink-0 items-center gap-2 pt-0.5 font-mono text-xs uppercase tracking-[0.08em] text-faded-sumi">
						{showDot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-matcha-green/70" />}
						{open ? "Less" : "Optional"}
						<IconChevronDown
							aria-hidden="true"
							className={cn("h-3 w-3 transition-transform duration-200 ease-out", open ? "rotate-180" : "rotate-0")}
						/>
					</span>
				</button>
			</h2>
			{open && (
				<div className="mt-3 flex flex-col gap-6 border-t border-soft-hairline pt-5">
					{children}
				</div>
			)}
		</SectionCard>
	);
}

// ── Deck picker card ──────────────────────────────────────────────────────────
//
// First SectionCard in the form stack. The card's deck is editable here: the
// content PATCH doesn't carry a deck change, so a switch is reconciled at save
// time via the move endpoint (see onSave). When the user has no other decks,
// there's nothing to switch to, so it degrades to the read-only chip it was
// before — a calm statement of where the card lives.

interface DeckPickerCardProps {
	decks: DeckOption[];
	value: string;
	currentDeckId: string;
	deckName: string;
	onChange: (deckId: string) => void;
}

export function DeckPickerCard({
	decks,
	value,
	currentDeckId,
	deckName,
	onChange,
}: DeckPickerCardProps): React.JSX.Element {
	const hasAlternatives = decks.some(d => d.id !== currentDeckId);
	const moved = value !== currentDeckId;

	// No other decks to move into → keep the original read-only presentation.
	if (!hasAlternatives) {
		return (
			<SectionCard
				kanji="組"
				label="Deck"
				description={`This card lives in ${deckName}. Create another deck to move it elsewhere.`}
			>
				<div className="pt-1">
					<span className="inline-flex items-center rounded-xs border border-soft-hairline bg-cream-inset px-2.5 py-1 text-sm text-sumi-ink">
						{deckName}
					</span>
				</div>
			</SectionCard>
		);
	}

	const options: ReadonlyArray<TomoSelectOption<string>> = decks.map(d => ({ value: d.id, label: d.name }));

	return (
		<SectionCard
			kanji="組"
			label="Deck"
			description="The deck this card belongs to. Switch it to move the card on save."
		>
			<div className="flex flex-col gap-2 pt-1">
				<span id="deck-label" className="text-sm font-medium text-sumi-ink/85">Deck</span>
				<TomoSelect<string>
					value={value}
					options={options}
					onValueChange={onChange}
					ariaLabelledBy="deck-label"
				/>
				{moved && (
					<p role="status" className="mt-1 text-sm text-faded-sumi">
						Saving moves this card to the new deck. Its review history and scheduling come with it.
					</p>
				)}
			</div>
		</SectionCard>
	);
}

// ── Preview block ─────────────────────────────────────────────────────────────

interface PreviewBlockProps {
	card: ApiDueCard;
	flipped: boolean;
	onFlip: () => void;
	aiError: string | null;
	sentenceCount: number;
	sentenceIndex: number;
	onPrevSentence: () => void;
	onNextSentence: () => void;
}

export function PreviewBlock({
	card,
	flipped,
	onFlip,
	aiError,
	sentenceCount,
	sentenceIndex,
	onPrevSentence,
	onNextSentence,
}: PreviewBlockProps): React.JSX.Element {
	// The pager only earns its place once a card has more than one sentence;
	// with 0 or 1 there is nothing to rotate, so it stays hidden.
	const showPager = sentenceCount > 1;
	const flipToggle = (
		<button
			type="button"
			onClick={onFlip}
			aria-pressed={flipped}
			aria-label={flipped ? "Show front of card" : "Show back of card"}
			className={cn(
				"inline-flex items-center gap-2 rounded-xs px-1.5 py-0.5",
				"text-sm",
				"text-faded-sumi hover:text-sumi-ink transition-colors duration-150",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
			)}
		>
			<IconUndo aria-hidden="true" className="w-[11px] h-[11px]" />
			{flipped ? "Show front" : "Show back"}
		</button>
	);

	return (
		<div className="flex flex-col gap-3">
			<SectionCard
				kanji="観"
				label="Preview"
				description="The card as the learner will see it in practice."
				rightContent={flipToggle}
			>
				<div
					aria-live="polite"
					aria-atomic="true"
					className="px-1 pt-3 pb-4 md:px-2 md:pt-5 md:pb-6"
				>
					{flipped
						? <CardBack card={card} exampleSentenceIndex={sentenceIndex} />
						: <CardFront card={card} exampleSentenceIndex={sentenceIndex} />}
				</div>
			</SectionCard>

			{showPager && (
				<div className="flex items-center justify-end gap-3 px-1">
					<div className="flex items-center gap-2">
						<PagerButton
							onClick={onPrevSentence}
							disabled={sentenceIndex <= 0}
							ariaLabel="Preview previous sentence"
						>
							‹
						</PagerButton>
						<span className="text-sm text-faded-sumi tabular-nums" aria-live="polite">
							Sentence
							{" "}
							{sentenceIndex + 1}
							{" "}
							of
							{sentenceCount}
						</span>
						<PagerButton
							onClick={onNextSentence}
							disabled={sentenceIndex >= sentenceCount - 1}
							ariaLabel="Preview next sentence"
						>
							›
						</PagerButton>
					</div>
				</div>
			)}

			{aiError !== null && <p role="alert" className="text-sm text-error">{aiError}</p>}
		</div>
	);
}

// Square chevron control for the preview sentence pager. Disabled at the ends
// of the list; matches the quiet font-mono register of the preview chrome.
function PagerButton({
	onClick,
	disabled,
	ariaLabel,
	children,
}: {
	onClick: () => void;
	disabled: boolean;
	ariaLabel: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			className={cn(
				"inline-flex h-6 w-6 items-center justify-center rounded-xs",
				"border border-soft-hairline font-mono text-sm leading-none",
				"transition-colors duration-150",
				disabled
					? "text-faded-sumi/40 cursor-not-allowed"
					: "text-faded-sumi hover:text-sumi-ink hover:border-sumi-ink/30",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
			)}
		>
			{children}
		</button>
	);
}

// ── Save block ────────────────────────────────────────────────────────────────
//
// Inline action under the preview — no SectionCard wrapper. The preview is
// the artifact, this is the verb. A single status line above the button
// names the load-bearing blocker (or confirms readiness) so the requirement
// stays visible without competing for attention. A Cancel link sits beside
// Save so leaving without changes is one click.

interface SaveBlockProps {
	saving: boolean;
	/**
	 * Disables the button while in flight. The button stays enabled with
	 *  blockers present so a click can surface them.
	 */
	busy: boolean;
	blockers: string[];
	/** A blocked attempt escalates the blocker line from calm guidance to error. */
	attemptedSave: boolean;
	saveError: string | null;
	onSave: () => void;
	onCancel: () => void;
}

export function SaveBlock({
	saving,
	busy,
	blockers,
	attemptedSave,
	saveError,
	onSave,
	onCancel,
}: SaveBlockProps): React.JSX.Element {
	const blocked = blockers.length > 0;
	return (
		<div className="flex flex-col gap-3 px-1">
			{blocked
				? (
						<p
							role={attemptedSave ? "alert" : "status"}
							className={cn("text-sm", attemptedSave ? "text-error" : "text-faded-sumi")}
						>
							{blockers[0]}
						</p>
					)
				: (
						<p className="text-sm text-faded-sumi">Ready to save your changes.</p>
					)}
			<div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
				<Button
					type="button"
					variant="primary"
					size="lg"
					onClick={onSave}
					disabled={busy}
					loading={saving}
					className="w-full sm:flex-1"
				>
					Save changes
				</Button>
				<Button
					type="button"
					variant="editorial"
					size="lg"
					onClick={onCancel}
					disabled={saving}
					className="w-full sm:w-auto"
				>
					Cancel
				</Button>
			</div>
			<SaveShortcutHint />
			{saveError !== null && (
				<p className="text-sm text-error" role="alert">{saveError}</p>
			)}
		</div>
	);
}

// Quiet keyboard-shortcut hint under the Save button, so the existing
// Cmd/Ctrl+Enter path is discoverable instead of hidden. Resolved after mount:
// shown only on keyboard-capable (fine-pointer) devices, so touch users aren't
// told to press a key they don't have. Starting hidden also keeps SSR
// hydration deterministic (server and first client render both emit nothing).
function SaveShortcutHint(): React.JSX.Element | null {
	const [hint, setHint] = useState<{ show: boolean; isMac: boolean }>({ show: false, isMac: false });
	useEffect(() => {
		const finePointer = window.matchMedia("(pointer: fine)").matches;
		const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
		setHint({ show: finePointer, isMac });
	}, []);
	if (!hint.show)
		return null;
	return (
		<p className="text-xs text-faded-sumi">
			Press
			{" "}
			<kbd className="rounded-xs border border-soft-hairline px-1 py-0.5 font-mono text-sm text-sumi-ink/70">
				{hint.isMac ? "⌘" : "Ctrl"}
			</kbd>
			{" "}
			<kbd className="rounded-xs border border-soft-hairline px-1 py-0.5 font-mono text-sm text-sumi-ink/70">
				Enter
			</kbd>
			{" "}
			to save.
		</p>
	);
}
