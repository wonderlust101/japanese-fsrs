"use client";

import type { ApiDeck, ApiPremadeDeck } from "@fsrs-japanese/shared-types";
import type { SortKey } from "./use-premade-filters";
import Link from "next/link";

import { useMemo, useRef } from "react";
import { DecksMenu, MenuItem } from "@/app/(app)/decks/_components/decks-menu";
import { DecksPagination } from "@/app/(app)/decks/_components/decks-pagination";
import { IconSort } from "@/components/icons/chrome-marks";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Pill";
import { QuietLink } from "@/components/ui/QuietLink";
import { SectionCard } from "@/components/ui/SectionCard";
import { Toast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/TomoLoader";
import { ToolbarChip } from "@/components/ui/ToolbarChip";
import { useDecksPremadeDevState } from "@/dev/panels/decks-premade";
import { useDecks } from "@/lib/api/decks";
import { usePremadeDecks } from "@/lib/api/premade";
import { usePremadeCopy } from "./use-premade-copy";
import { JLPT_LABEL, JLPT_ORDER, SORT_LABEL, SORT_ORDER, usePremadeFilters } from "./use-premade-filters";

// ── Catalogue ────────────────────────────────────────────────────────────────

/**
 * Premade deck catalogue.
 *
 * Reuses Tomo's standard page chrome — `PageHeader` rhythm via the parent
 * page, `SectionCard` for each entry, `JlptPill`/`StatusPill` for metadata,
 * and `Button`/`QuietLink` for actions. The control row (JLPT filter + Sort)
 * uses the same toolbar primitives as the Decks and Cards pages (`ToolbarChip`
 * triggers + `DecksMenu`/`MenuItem` dropdowns), and the footer reuses the
 * Decks page's `DecksPagination`, so the surface reads as a sibling of the
 * library. Entries stack in a single full-width column so each card has room
 * for its name, metadata, and description without crowding.
 *
 * Filter, sort, and pagination all run client-side over the already-fetched
 * list — the catalogue is small enough that server-side paging wouldn't earn
 * its complexity. State stays in component state (not localStorage): the
 * catalogue is a low-frequency surface, so a fresh visit shows the full view.
 */
export function PremadeCatalogue(): React.JSX.Element {
	useDecksPremadeDevState();

	const decksQuery = usePremadeDecks();
	const userDecksQuery = useDecks(50);

	// Scroll anchor for the pagination footer: a page change scrolls back to the
	// controls, matching the Decks list behavior.
	const toolbarRef = useRef<HTMLElement | null>(null);

	const allDecks = useMemo(() => decksQuery.data?.items ?? [], [decksQuery.data]);

	// Build a `premadeId → user deck` map so each catalogue card can detect
	// whether the learner has already copied that premade entry. Duplicates
	// are allowed under the copy model — when more than one user deck shares
	// a `sourcePremadeId`, we keep the most-recently-created one so the
	// "View deck" link routes somewhere sensible. The catalogue badge stays
	// a binary "in your library" — count is not surfaced here.
	const userDeckByPremadeId = useMemo(() => {
		const map = new Map<string, ApiDeck>();
		const items = userDecksQuery.data?.items ?? [];
		for (const deck of items) {
			if (deck.sourcePremadeId === null)
				continue;
			const existing = map.get(deck.sourcePremadeId);
			if (existing === undefined || deck.createdAt > existing.createdAt) {
				map.set(deck.sourcePremadeId, deck);
			}
		}
		return map;
	}, [userDecksQuery.data]);

	// Client-side JLPT filter + sort + pagination. See use-premade-filters.
	const {
		jlpt,
		setJlpt,
		sort,
		setSort,
		setPage,
		pageSize,
		setPageSize,
		totalCount,
		totalPages,
		safePage,
		pageItems,
		jlptTriggerLabel,
	} = usePremadeFilters(allDecks);

	// Copy-to-library action (tracks the in-flight row) + its toast. See
	// use-premade-copy.
	const { handleCopy, pendingId, toast, dismissToast } = usePremadeCopy();

	// ── States ────────────────────────────────────────────────────────────────

	if (decksQuery.isError) {
		return (
			<>
				<ErrorState onRetry={() => void decksQuery.refetch()} />
				{toast !== null && (
					<Toast
						key={toast.key}
						message={toast.message}
						kind={toast.kind}
						onDismiss={dismissToast}
					/>
				)}
			</>
		);
	}

	if (decksQuery.isLoading) {
		return <PageLoader />;
	}

	return (
		<>
			<section
				ref={toolbarRef}
				aria-label="Premade deck controls"
				className="flex flex-wrap items-center gap-2"
			>
				<FilterDropdown
					triggerLabel={jlptTriggerLabel}
					selected={jlpt !== "all"}
					options={JLPT_ORDER.map(v => ({ value: v, label: JLPT_LABEL[v] }))}
					activeValue={jlpt}
					onPick={setJlpt}
				/>
				<SortDropdown value={sort} onChange={setSort} />
			</section>

			<section
				aria-label="Premade decks"
				className="mt-6 flex flex-col gap-6"
			>
				{pageItems.map(deck => (
					<CatalogueCard
						key={deck.id}
						deck={deck}
						copiedDeck={userDeckByPremadeId.get(deck.id) ?? null}
						onCopy={() => handleCopy(deck)}
						pending={pendingId === deck.id}
						disabled={pendingId !== null && pendingId !== deck.id}
					/>
				))}
			</section>

			{totalCount === 0
				? (
						<EmptyState
							hasFilter={jlpt !== "all"}
							onResetFilter={() => setJlpt("all")}
						/>
					)
				: (
						<DecksPagination
							page={safePage}
							pageSize={pageSize}
							totalCount={totalCount}
							scrollTargetEl={toolbarRef}
							onPickPage={setPage}
							onPrev={() => setPage(p => Math.max(1, p - 1))}
							onNext={() => setPage(p => Math.min(totalPages, p + 1))}
							onPageSizeChange={setPageSize}
						/>
					)}

			{toast !== null && (
				<Toast
					key={toast.key}
					message={toast.message}
					kind={toast.kind}
					onDismiss={dismissToast}
				/>
			)}
		</>
	);
}

// ── Sort dropdown ───────────────────────────────────────────────────────────
// Mirrors the decks-page SortDropdown: a `ToolbarChip` (icon + "Sort <value>")
// over the headless `DecksMenu`, sitting beside the JLPT filter chip.

function SortDropdown({
	value,
	onChange,
}: {
	value: SortKey;
	onChange: (next: SortKey) => void;
}): React.JSX.Element {
	return (
		<DecksMenu
			align="start"
			menuClassName="min-w-[12rem]"
			renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
				<ToolbarChip
					ref={triggerRef}
					onClick={onClick}
					onKeyDown={onKeyDown}
					aria-haspopup="menu"
					aria-expanded={ariaExpanded}
					leadingNode={<IconSort className="h-3.5 w-3.5 text-faded-sumi" />}
					trailingNode={<Chevron />}
					className="min-h-11 sm:min-h-0 active:bg-cream-inset"
				>
					<span className="hidden text-faded-sumi sm:inline">Sort </span>
					<span className="text-sumi-ink">{SORT_LABEL[value]}</span>
				</ToolbarChip>
			)}
			renderItems={({ close }) => (
				<>
					{SORT_ORDER.map(key => (
						<MenuItem
							key={key}
							selected={key === value}
							onClick={() => { onChange(key); close(); }}
						>
							{SORT_LABEL[key]}
						</MenuItem>
					))}
				</>
			)}
		/>
	);
}

// ── Filter dropdown (shared toolbar primitives) ──────────────────────────────
// Mirrors the cards-page `ChromeDropdown` and the decks-page `TypeDropdown`: a
// `ToolbarChip` trigger over the headless `DecksMenu`, so the premade filters
// match the rest of the app's chrome (keyboard nav, click-outside, portaling)
// exactly instead of a bespoke native <select>.

interface FilterDropdownProps<T extends string> {
	/** Self-identifying trigger text (e.g. 'JLPT N5', 'All types'). */
	triggerLabel: string;
	/** Drives the chip's selected (vermillion-wash) treatment. */
	selected: boolean;
	options: ReadonlyArray<{ value: T; label: string }>;
	activeValue: T;
	onPick: (value: T) => void;
}

function FilterDropdown<T extends string>({
	triggerLabel,
	selected,
	options,
	activeValue,
	onPick,
}: FilterDropdownProps<T>): React.JSX.Element {
	return (
		<DecksMenu
			align="start"
			menuClassName="min-w-[12rem]"
			renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
				<ToolbarChip
					ref={triggerRef}
					onClick={onClick}
					onKeyDown={onKeyDown}
					aria-haspopup="menu"
					aria-expanded={ariaExpanded}
					state={selected ? "selected" : "default"}
					trailingNode={<Chevron />}
					// 44px touch target on mobile, release to the default h-9 on
					// desktop — the same sizing pattern the decks utility row uses.
					className="min-h-11 sm:min-h-0 active:bg-cream-inset"
				>
					<span className="whitespace-nowrap">{triggerLabel}</span>
				</ToolbarChip>
			)}
			renderItems={({ close }) => (
				<>
					{options.map(opt => (
						<MenuItem
							key={opt.value}
							selected={opt.value === activeValue}
							onClick={() => { onPick(opt.value); close(); }}
						>
							{opt.label}
						</MenuItem>
					))}
				</>
			)}
		/>
	);
}

function Chevron(): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="text-faded-sumi"
		>
			<path d="M2 4l3 3 3-3" />
		</svg>
	);
}

// ── Catalogue card ──────────────────────────────────────────────────────────

interface CatalogueCardProps {
	deck: ApiPremadeDeck;
	/**
	 * The user's most-recently-created deck that was copied from this premade
	 *  entry, or `null` when the user hasn't copied it yet. Drives the "In your
	 *  library" indicator and the "View deck" affordance.
	 */
	copiedDeck: ApiDeck | null;
	onCopy: () => void;
	pending: boolean;
	disabled: boolean;
}

function CatalogueCard({
	deck,
	copiedDeck,
	onCopy,
	pending,
	disabled,
}: CatalogueCardProps): React.JSX.Element {
	const domain = deck.domain;
	const isCopied = copiedDeck !== null;
	const cardCountLabel = `${deck.cardCount.toLocaleString()} ${deck.cardCount === 1 ? "card" : "cards"}`;

	// Byline level token. Every shipping deck carries a JLPT level; a future
	// level-agnostic deck (a Joyo Kanji set, say) falls back to its content type.
	const levelText
		= deck.jlptLevel === null
			? (deck.deckType === "kanji" ? "Kanji" : deck.deckType === "mixed" ? "Mixed" : "Vocabulary")
			: deck.jlptLevel === "beyond_jlpt"
				? "Beyond JLPT"
				: `JLPT ${deck.jlptLevel}`;

	return (
		<SectionCard kanji="集" label={cardCountLabel} omitTitle>
			<article className="grid gap-x-6 gap-y-3.5 sm:grid-cols-[minmax(0,1fr)_auto]">
				{/* Headline + byline. */}
				<div className="flex min-w-0 flex-col gap-1.5 sm:col-start-1 sm:row-start-1">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span
							lang="ja"
							aria-hidden="true"
							className="shrink-0 font-display text-lg leading-none text-inari-vermillion translate-y-[0.06em]"
						>
							集
						</span>
						<h2 className="min-w-0 text-balance break-words font-display text-xl font-medium leading-tight text-sumi-ink">
							{isCopied && copiedDeck !== null
								? (
										<Link
											href={`/decks/${copiedDeck.id}/preview`}
											aria-label={`Preview ${deck.name}`}
											className="ui-motion-colors rounded-xs underline-offset-4 hover:text-inari-vermillion hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
										>
											{deck.name}
										</Link>
									)
								: (
										deck.name
									)}
						</h2>
						{isCopied && (
							<StatusPill
								status="subscribed"
								label="In your library"
								size="sm"
								className="!rounded-xs !leading-tight"
							/>
						)}
					</div>

					{/* Byline: level · size · (domain). Quiet mono; the count is the one
              inked figure, since size is what a learner weighs. */}
					<p className="font-mono text-xs text-faded-sumi tabular-nums">
						{levelText}
						<span aria-hidden="true" className="px-1.5 text-faded-sumi/50">·</span>
						<span className="text-sumi-ink">{deck.cardCount.toLocaleString()}</span>
						{" "}
						{deck.cardCount === 1 ? "card" : "cards"}
						{domain !== null && domain.trim().length > 0 && (
							<>
								<span aria-hidden="true" className="px-1.5 text-faded-sumi/50">·</span>
								{domain}
							</>
						)}
					</p>
				</div>

				{/* Body: the reason to choose this deck, set as the hero at a readable
            measure. Ordered before the action in the DOM so it reads first when
            the row stacks on mobile; on sm+ it drops to its own row beneath
            both columns, leaving an intentional right margin. */}
				{deck.description !== null && deck.description.trim().length > 0 && (
					<p className="max-w-measure text-pretty text-base leading-relaxed text-faded-sumi line-clamp-3 sm:col-span-2 sm:row-start-2">
						{deck.description}
					</p>
				)}

				{/* The one action: top-right on sm+, last in the stack on mobile. */}
				<div className="flex flex-col items-start gap-2 sm:col-start-2 sm:row-start-1 sm:items-end sm:justify-self-end">
					{isCopied && copiedDeck !== null
						? (
								<>
									<Link href={`/decks/${copiedDeck.id}/preview`}>
										<Button
											type="button"
											variant="primary"
											size="sm"
											aria-label={`View ${deck.name} in your library`}
										>
											View deck
										</Button>
									</Link>
									<QuietLink
										onClick={onCopy}
										tone="sumi"
										size="sm"
										ariaLabel={`Add another copy of ${deck.name} to your library`}
									>
										{pending ? "Adding another copy…" : "Add another copy"}
									</QuietLink>
								</>
							)
						: (
								<Button
									type="button"
									variant="primary"
									size="sm"
									onClick={onCopy}
									loading={pending}
									disabled={disabled}
									aria-label={`Add ${deck.name} to your library`}
								>
									Add to my library
								</Button>
							)}
				</div>
			</article>
		</SectionCard>
	);
}

// ── Empty + error ───────────────────────────────────────────────────────────

interface EmptyStateProps {
	hasFilter: boolean;
	onResetFilter: () => void;
}

function EmptyState({ hasFilter, onResetFilter }: EmptyStateProps): React.JSX.Element {
	if (hasFilter) {
		// Same kanji eyebrow vocabulary as cards's filtered-zero state
		// (空, "kara"). Carries the sibling-consistency rule across both
		// pages: filtered-to-nothing reads the same way everywhere.
		return (
			<div className="mt-8 rounded-xs border border-soft-hairline bg-cream-inset/55 px-6 py-10 text-center">
				<span
					lang="ja"
					aria-hidden="true"
					className="font-display text-numeral leading-none text-inari-vermillion/75"
				>
					空
				</span>
				<p className="mt-3 text-sm font-medium text-sumi-ink">No decks at this level yet.</p>
				<p className="mx-auto mt-1.5 max-w-measure-tight text-sm text-faded-sumi">
					Try a different JLPT level, or clear the filter to see every deck.
				</p>
				<div className="mt-5">
					<Button size="sm" variant="secondary" onClick={onResetFilter}>
						Clear filters
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mt-8 rounded-xs border border-soft-hairline bg-cream-inset/55 px-6 py-10 text-center">
			<p className="text-sm font-medium text-sumi-ink">No premade decks yet.</p>
			<p className="mx-auto mt-1.5 max-w-measure-tight text-sm text-faded-sumi">
				Curated decks land here as Tomo&rsquo;s catalogue grows. In the
				meantime, build your own from a word or sentence.
			</p>
			<div className="mt-5 flex items-center justify-center gap-2">
				<Link
					href="/add"
					className="ui-motion-pressable inline-flex h-9 items-center rounded-xs border border-soft-hairline bg-warm-paper-raised px-3 text-sm font-medium text-sumi-ink hover:bg-cream-inset hover:border-faded-sumi focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
				>
					Add Japanese
				</Link>
			</div>
		</div>
	);
}

interface ErrorStateProps {
	onRetry: () => void;
}

function ErrorState({ onRetry }: ErrorStateProps): React.JSX.Element {
	return (
		<div
			role="alert"
			className="mt-6 rounded-xs border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
		>
			<p className="font-medium">Couldn&rsquo;t load the catalogue.</p>
			<p className="mt-1 text-error-deep/80">
				Check your connection and try again.
			</p>
			<div className="mt-4">
				<Button size="sm" variant="secondary" onClick={onRetry}>
					Try again
				</Button>
			</div>
		</div>
	);
}
