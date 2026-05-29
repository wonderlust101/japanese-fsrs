"use client";

// Form scaffolding for the add-review card editor: page frame, section
// requirement tag, collapsible optional section, deck picker, the live
// preview block + pager, the save block, and the success block. Lifted out of
// generated-review-client.tsx.

import type { ApiDueCard } from "@fsrs-japanese/shared-types";

import type { TomoSelectOption } from "@/components/ui/TomoSelect";

import { useEffect, useState } from "react";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { IconChevronDown, IconUndo } from "@/components/icons/chrome-marks";
import { CardBack } from "@/components/review/session/CardBack";
import { CardFront } from "@/components/review/session/CardFront";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
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
// Quiet header marker stating whether a section gates saving. Only Deck and
// Definition are required; everything else is optional. Rendered in the
// section header's rightContent slot so the contract is scannable down the
// long form without competing with the field labels.

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
// section still holds data, so disclosure never hides it silently. Deck and
// Definition stay plain (always-open) SectionCards — they gate saving.

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
	const [open, setOpen] = useState(false);
	const showDot = !open && count === undefined && hasContent;

	// WAI-ARIA accordion: the whole header is a button wrapped in an <h2>, so the
	// entire row toggles (a generous target) while the section title stays a real
	// heading. `omitTitle` skips SectionCard's own CardHeader so we own the
	// markup — which also means the rule and spacing are conditional in JSX (no
	// arbitrary-variant `!important` hacks needed). Header typography mirrors
	// CardHeader so these read identically to the required Deck / Definition
	// cards above.
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

// ── Deck card ─────────────────────────────────────────────────────────────────
//
// First SectionCard in the form stack. Treats deck assignment as a structural
// decision in the same register as Definition / Pronunciation / Teaching
// notes, with a single inline "Required" line under the select when empty so
// the requirement is locatable without doubling the Save-block blocker copy.

interface DeckCardProps {
	options: ReadonlyArray<TomoSelectOption<string>>;
	value: string | null;
	onChange: (next: string) => void;
	loading: boolean;
	deckName: string | null;
}

// The requirement is carried by the header "Required" tag (at the field) and
// the SaveBlock blocker line (at the action) — the same two-signal pattern the
// Definition card uses. The card's own description handles locality, so no
// inline error line is needed here.
export function DeckCard({ options, value, onChange, loading, deckName }: DeckCardProps): React.JSX.Element {
	const empty = value === null;
	return (
		<SectionCard
			kanji="組"
			label="Deck"
			rightContent={<SectionRequirement />}
			description={
				empty
					? "Pick where this card will live."
					: `This card will be saved to ${deckName ?? "your selected deck"}.`
			}
		>
			<div className="pt-1">
				<div className="w-full sm:max-w-[440px]">
					<TomoSelect<string>
						value={value ?? ""}
						options={options}
						onValueChange={onChange}
						ariaLabel="Choose a deck"
						placeholder={loading ? "Loading decks…" : "Choose a deck…"}
						disabled={loading || options.length === 0}
					/>
				</div>
			</div>
		</SectionCard>
	);
}

// ── Preview block ─────────────────────────────────────────────────────────────

interface PreviewBlockProps {
	card: ApiDueCard;
	flipped: boolean;
	onFlip: () => void;
	loading: boolean;
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
	loading,
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
				// Roomier vertical hit area on touch; collapses to the quiet inline
				// size on fine-pointer (sm+) so the desktop chrome stays understated.
				"inline-flex items-center gap-2 rounded-xs px-2 py-2 sm:px-1.5 sm:py-0.5",
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
					className={cn(
						"px-1 pt-3 pb-4 md:px-2 md:pt-5 md:pb-6 transition-opacity duration-200 ease-out",
						loading && "opacity-70",
					)}
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

			{loading && (
				<p role="status" className="text-sm text-faded-sumi">
					Preparing card…
				</p>
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
				// Touch-first sizing: ~40px hit area on phones, tightened to the quiet
				// 28px chrome size once a fine pointer is the likely input (sm+).
				"inline-flex h-10 w-10 sm:h-7 sm:w-7 items-center justify-center rounded-xs",
				"border border-soft-hairline font-mono text-base sm:text-sm leading-none",
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
// stays visible without competing for attention.

interface SaveBlockProps {
	saving: boolean;
	/**
	 * Disables the button while in flight (generating or saving). The button
	 *  stays enabled with blockers present so a click can surface them.
	 */
	busy: boolean;
	blockers: string[];
	/** A blocked attempt escalates the blocker line from calm guidance to error. */
	attemptedSave: boolean;
	saveError: string | null;
	onSave: () => void;
}

export function SaveBlock({
	saving,
	busy,
	blockers,
	attemptedSave,
	saveError,
	onSave,
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
						<p className="text-sm text-faded-sumi">Ready to save.</p>
					)}
			<Button
				type="button"
				variant="primary"
				size="lg"
				onClick={onSave}
				disabled={busy}
				loading={saving}
				className="w-full"
			>
				Save card
			</Button>
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
		setHint({ show: finePointer, isMac }); // eslint-disable-line react/set-state-in-effect -- reads pointer/platform on mount (client-only); starts hidden for deterministic SSR
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

// ── Success ───────────────────────────────────────────────────────────────────

interface SuccessBlockProps {
	count: number;
	deckName: string;
	onAddAnother: () => void;
	onReturnToToday: () => void;
}

export function SuccessBlock({ count, deckName, onAddAnother, onReturnToToday }: SuccessBlockProps): React.JSX.Element {
	const cardsWord = count === 1 ? "card" : "cards";
	return (
		<SectionCard kanji="済" label="Saved">
			<div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
				<div className="min-w-0">
					<h1 className="font-display text-display leading-[1.05] text-sumi-ink">
						Saved
						{" "}
						{count}
						{" "}
						{cardsWord}
						{" "}
						to
						{" "}
						{deckName}
						.
					</h1>
					<p className="mt-3 max-w-measure text-base text-faded-sumi leading-relaxed">
						Keep adding, or return to Today.
					</p>
					<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
						<Button variant="primary" size="lg" onClick={onAddAnother} autoFocus>
							Add another
						</Button>
						<Button variant="editorial" size="lg" onClick={onReturnToToday}>
							Return to Today
						</Button>
					</div>
				</div>
				<div aria-hidden="true" className="flex items-center justify-center lg:order-last lg:pl-4">
					<Logo size={96} showWordmark={false} priority />
				</div>
			</div>
		</SectionCard>
	);
}
