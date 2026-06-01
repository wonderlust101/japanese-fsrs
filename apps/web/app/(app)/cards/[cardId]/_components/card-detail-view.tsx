"use client";

import {
	getSentenceFrontBack,
	getVocabularyFields,
	getWordFields,

} from "@fsrs-japanese/shared-types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useRef, useState } from "react";
import { SetTopBar } from "@/app/(app)/_components/set-top-bar";
import { MoveCardDialog } from "@/app/(app)/decks/[id]/_components/move-card-dialog";
import { CardBack } from "@/components/review/session/CardBack";
import { FrequencyBadge } from "@/components/review/session/FrequencyBadge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SectionCard } from "@/components/ui/SectionCard";
import { Toast, useToast } from "@/components/ui/Toast";
import { PageLoader, TomoLoader } from "@/components/ui/TomoLoader";
import { useCardDevState } from "@/dev/panels/card-detail";
import { useRevealMount } from "@/hooks/use-reveal-mount";
import { getCardByIdAction } from "@/lib/actions/cards.actions";
import { queryKeys } from "@/lib/api/queryKeys";

import { CardActionsStrip } from "./card-actions-strip";
import { CardHistoryPanel } from "./card-history-panel";
import { CardIdentityHeader } from "./card-identity-header";
import { PagerButton } from "./card-tools";
import { useCardDetailMutations } from "./use-card-detail-mutations";
import { useCardDetailShortcuts } from "./use-card-detail-shortcuts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
	cardId: string;
	deckId: string;
	deckName: string;
}

type ActiveDialog
	= | { kind: "none" }
		| { kind: "delete" }
		| { kind: "move" }
		| { kind: "suspend" }
		| { kind: "forget" }
		| { kind: "reschedule" };

// ─── Component ────────────────────────────────────────────────────────────────

export function CardDetailView({ cardId, deckId, deckName }: Props): React.JSX.Element {
	const router = useRouter();

	const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: "none" });
	const [showHistory, setShowHistory] = useState(false);
	const [resetCount, setResetCount] = useState(false);
	// Which example sentence the card back shows. Mirrors the /add/review and
	// edit preview pagers: pinning makes this view deterministic (the review
	// back rotates per-review) and the pager below steps through the others.
	const [sentenceIndex, setSentenceIndex] = useState(0);
	const { toast, showToast, dismissToast } = useToast();

	// `gcTime: 0` pairs with `useSuspenseQuery` to evict cache on unmount so
	// navigation back always fetches fresh card data instead of flashing stale.
	const { data: liveCard } = useSuspenseQuery({
		queryKey: queryKeys.cards.detail(cardId),
		queryFn: () => getCardByIdAction(cardId),
		gcTime: 0,
	});

	// Dev-only fixture override. In production, devState is always
	// `{ fixture: 'off', card: null, loading: false }` and `panel` is null;
	// the card binding falls through to the live query.
	const devState = useCardDevState(deckId);
	const card = devState.fixture === "off" ? liveCard : devState.card;
	const isLoading = devState.fixture === "off" ? false : devState.loading;

	// ── Content extraction ────────────────────────────────────────────────
	// The CardBack component (rendered below) does its own field resolution
	// via `resolveCardFields`, so the orchestrator only extracts what the
	// page chrome needs: the headword + reading/meaning for the identity
	// header and the frequency rank for the bonded badge on the card.
	// (Scheduling/FSRS fields are read directly by CardHistoryPanel.)
	const wordFields = card != null ? getWordFields(card) : null;
	const sentence = card != null ? getSentenceFrontBack(card) : null;

	const word = wordFields?.word ?? sentence?.front ?? "—";
	// Identity subline: reading sits under the headword for word cards; for
	// sentence cards there's no reading, so the English translation (back)
	// carries the meaning slot instead.
	const reading = wordFields?.reading ?? null;
	const meaning = wordFields?.meaning ?? sentence?.back ?? null;
	const frequencyRank = wordFields?.frequencyRank ?? undefined;

	// Example-sentence pager. Only vocabulary cards carry an `exampleSentences`
	// array; sentence-layout cards have one sentence (no pager). Clamp so the
	// index survives a card swap (e.g. after a move) without going stale.
	const sentenceCount = card != null ? (getVocabularyFields(card)?.exampleSentences?.length ?? 0) : 0;
	const clampedSentence = sentenceCount > 0 ? Math.min(sentenceIndex, sentenceCount - 1) : 0;
	const showPager = sentenceCount > 1;

	const isPremadeSource = card !== null && card !== undefined && (card as { userId?: string | null }).userId === null;
	const isSuspended = card?.isSuspended === true;

	// ── Mutations: delete / suspend / unsuspend / move / forget / reschedule,
	// plus the suspend-direction-aware pending + error projection. See
	// use-card-detail-mutations.
	const {
		deleteMutation,
		suspendMutation,
		unsuspendMutation,
		moveMutation,
		forgetMutation,
		rescheduleMutation,
		suspendPending,
		suspendError,
	} = useCardDetailMutations({ cardId, deckId, isSuspended });

	function closeRepairDialog(): void {
		if (forgetMutation.isPending || rescheduleMutation.isPending)
			return;
		setActiveDialog({ kind: "none" });
		forgetMutation.reset();
		rescheduleMutation.reset();
	}

	const editHref = `/cards/${cardId}/edit`;

	// Page-level shortcuts: E edits (no-op on premade), Shift+M toggles the
	// memory popup. See use-card-detail-shortcuts.
	useCardDetailShortcuts({ editHref, isPremadeSource, setShowHistory });

	// Page-level reveal (mount mode). Three beats: the identity header lands as
	// the lead, the actions strip settles second, and the card-back SectionCard
	// arrives third. The example pager stays static (minor control); the memory
	// history Dialog has its own pass-1 motion (spec §P2.6: not revealed here).
	const contentRef = useRef<HTMLDivElement | null>(null);
	useRevealMount(contentRef, { stagger: 0.06, deps: [isLoading, card?.id ?? null] });

	if (isLoading) {
		return (
			<>
				<SetTopBar backHref={`/decks/${deckId}`} backAriaLabel={`Back to ${deckName}`} />
				<PageLoader />
			</>
		);
	}

	return (
		<>
			<SetTopBar kanji="札" label={word} labelLang="ja" backHref={`/decks/${deckId}`} backAriaLabel={`Back to ${deckName}`} />

			{/* Vertical centering: this wrapper fills the viewport minus the
          sticky TopBar (h-16 = 4rem) and uses flex to center its child on
          the remaining axis. Falls back to natural scroll when the content
          is taller than the viewport. */}
			<div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center bg-cool-paper-base py-10 lg:py-16">
				<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
					{/* Content spans the full 1440px container. */}
					<div ref={contentRef} className="w-full">

						{/* ── Page header — dictionary-style identity for this card.
                The headword is the hero (Japanese is the most beautiful
                thing on the page); deck + JLPT ride the eyebrow as context
                (and are therefore dropped from the meta strip below to keep
                the page from repeating itself). */}
						<div className="pb-3 sm:pb-4 lg:pb-5" data-reveal-lead>
							<CardIdentityHeader
								word={word}
								reading={reading}
								meaning={meaning}
								deckName={deckName}
								jlptLevel={card?.jlptLevel ?? null}
								isSuspended={isSuspended}
							/>
						</div>

						{/* ── Actions strip right under the header. Ordered by intent:
                modify → inspect → fix → pause → destroy. */}
						{card !== null && card !== undefined && (
							<div className="mb-6 lg:mb-7" data-reveal="">
								<CardActionsStrip
									editHref={editHref}
									isPremade={isPremadeSource}
									isSuspended={isSuspended}
									historyOpen={showHistory}
									onMove={() => setActiveDialog({ kind: "move" })}
									onToggleHistory={() => setShowHistory(v => !v)}
									onForget={() => { setResetCount(false); setActiveDialog({ kind: "forget" }); }}
									onReschedule={() => setActiveDialog({ kind: "reschedule" })}
									onSuspend={() => setActiveDialog({ kind: "suspend" })}
									onDelete={() => setActiveDialog({ kind: "delete" })}
								/>
							</div>
						)}

						{/* ── Body: the card itself. The memory / scheduling history
                opens in a popup (see the Dialog below) so the curve can use
                the full content width instead of a cramped side rail. */}
						<div className="flex flex-col gap-y-6 lg:gap-y-8">
							{isLoading && <LoadingBody />}

							{card !== null && card !== undefined && (
								<SectionCard kanji="札" label="Card back" omitTitle reveal>
									{/* Bonded top row mirrors the review card: the frequency
                      badge sits under the vermillion stripe. Renders only
                      when the card has a rank, so there's no empty row. */}
									{frequencyRank != null && (
										<div className="flex items-center gap-2 px-1 pt-3 pb-2 md:px-2 md:pt-4 md:pb-2">
											<FrequencyBadge rank={frequencyRank} />
										</div>
									)}
									<div className="px-1 pt-5 pb-2 md:px-2 md:pt-7 md:pb-3">
										<CardBack
											card={card}
											exampleSentenceIndex={clampedSentence}
											manageTabShortcuts
											revealTranslation
										/>
									</div>
								</SectionCard>
							)}

							{/* Example-sentence pager — same control as the /add/review and
                  edit previews: sits under the card, right-aligned. */}
							{card !== null && card !== undefined && showPager && (
								<div className="flex items-center justify-end gap-3 px-1">
									<div className="flex items-center gap-2">
										<PagerButton
											onClick={() => setSentenceIndex(i => Math.max(0, i - 1))}
											disabled={clampedSentence <= 0}
											ariaLabel="Previous example sentence"
										>
											‹
										</PagerButton>
										<span className="text-sm text-faded-sumi tabular-nums" aria-live="polite">
											Sentence
											{" "}
											{clampedSentence + 1}
											{" "}
											of
											{" "}
											{sentenceCount}
										</span>
										<PagerButton
											onClick={() => setSentenceIndex(i => Math.min(sentenceCount - 1, i + 1))}
											disabled={clampedSentence >= sentenceCount - 1}
											ariaLabel="Next example sentence"
										>
											›
										</PagerButton>
									</div>
								</div>
							)}
						</div>

					</div>
				</div>
			</div>

			{/* ── Dialogs ─────────────────────────────────────────────────────── */}
			<Dialog
				open={activeDialog.kind === "delete"}
				onClose={() => setActiveDialog({ kind: "none" })}
				title="Delete card"
			>
				<p className="mb-5 text-sm text-faded-sumi">
					Permanently delete
					{" "}
					<span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
					{" "}
					from
					{" "}
					{deckName}
					? This cannot be undone.
				</p>
				{deleteMutation.isError && (
					<p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
						{deleteMutation.error?.message ?? "Unknown error"}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						onClick={() => setActiveDialog({ kind: "none" })}
						disabled={deleteMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="danger"
						loading={deleteMutation.isPending}
						onClick={() => deleteMutation.mutate()}
					>
						Delete card
					</Button>
				</div>
			</Dialog>

			<Dialog
				open={activeDialog.kind === "suspend"}
				onClose={() => {
					if (suspendPending)
						return;
					setActiveDialog({ kind: "none" });
					suspendMutation.reset();
					unsuspendMutation.reset();
				}}
				title={isSuspended ? "Unsuspend card" : "Suspend card"}
			>
				<p className="mb-5 text-sm text-faded-sumi">
					{isSuspended
						? (
								<>
									Return
									{" "}
									<span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
									{" "}
									to the active review queue?
								</>
							)
						: (
								<>
									Pause
									{" "}
									<span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
									{" "}
									from appearing in reviews until you unsuspend it?
								</>
							)}
				</p>
				{suspendError !== null && (
					<p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
						{suspendError}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						onClick={() => {
							setActiveDialog({ kind: "none" });
							suspendMutation.reset();
							unsuspendMutation.reset();
						}}
						disabled={suspendPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="primary"
						loading={suspendPending}
						onClick={() => {
							const mutation = isSuspended ? unsuspendMutation : suspendMutation;
							mutation.mutate(cardId, {
								onSuccess: () => {
									setActiveDialog({ kind: "none" });
									showToast(isSuspended ? "Card unsuspended." : "Card suspended.");
								},
							});
						}}
					>
						{isSuspended ? "Unsuspend" : "Suspend"}
					</Button>
				</div>
			</Dialog>

			<Dialog
				open={activeDialog.kind === "forget"}
				onClose={closeRepairDialog}
				title="Forget card"
			>
				<p className="mb-4 text-sm text-faded-sumi">
					Reset scheduling on
					{" "}
					<span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
					{" "}
					and queue it as new again. Your review log stays intact.
				</p>
				<label className="mb-5 flex items-start gap-3 text-sm text-sumi-ink">
					<input
						type="checkbox"
						checked={resetCount}
						onChange={e => setResetCount(e.target.checked)}
						disabled={forgetMutation.isPending}
						className="mt-0.5 h-4 w-4 accent-inari-vermillion-deep"
					/>
					<span>
						<span className="block font-medium">Also reset lifetime counters</span>
						<span className="block text-xs text-faded-sumi">Zeroes reps + lapses. Off by default so the card&rsquo;s history stays in your analytics.</span>
					</span>
				</label>
				{forgetMutation.isError && (
					<p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
						{forgetMutation.error?.message ?? "Unknown error"}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<Button type="button" variant="ghost" onClick={closeRepairDialog} disabled={forgetMutation.isPending}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="primary"
						loading={forgetMutation.isPending}
						onClick={() => {
							const variables = resetCount ? { cardId, resetCount: true } : { cardId };
							forgetMutation.mutate(variables, {
								onSuccess: () => {
									setActiveDialog({ kind: "none" });
									showToast("Card forgotten.");
								},
							});
						}}
					>
						Forget card
					</Button>
				</div>
			</Dialog>

			<Dialog
				open={activeDialog.kind === "reschedule"}
				onClose={closeRepairDialog}
				title="Reschedule card"
			>
				<p className="mb-5 text-sm text-faded-sumi">
					Replay
					{" "}
					<span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
					&rsquo;s
					review history and recompute its schedule from scratch. This won&rsquo;t
					change your review log.
				</p>
				{rescheduleMutation.isError && (
					<p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">
						{rescheduleMutation.error?.message ?? "Unknown error"}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<Button type="button" variant="ghost" onClick={closeRepairDialog} disabled={rescheduleMutation.isPending}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="primary"
						loading={rescheduleMutation.isPending}
						onClick={() => {
							rescheduleMutation.mutate(cardId, {
								onSuccess: () => {
									setActiveDialog({ kind: "none" });
									showToast("Schedule recomputed.");
								},
							});
						}}
					>
						Reschedule card
					</Button>
				</div>
			</Dialog>

			<Dialog
				open={showHistory && card !== null && card !== undefined}
				onClose={() => setShowHistory(false)}
				eyebrow={{ kanji: "記", label: "MEMORY" }}
				size="5xl"
			>
				{card !== null && card !== undefined && (
					<div id="card-history-panel">
						<CardHistoryPanel card={card} />
					</div>
				)}
			</Dialog>

			<MoveCardDialog
				card={activeDialog.kind === "move" && card !== null && card !== undefined ? card : null}
				currentDeckId={deckId}
				variant="move"
				isSubmitting={moveMutation.isPending}
				errorMessage={moveMutation.isError ? (moveMutation.error?.message ?? "Unknown error") : null}
				onCancel={() => {
					setActiveDialog({ kind: "none" });
					moveMutation.reset();
				}}
				onConfirm={(target, targetDeckId) => {
					moveMutation.mutate(
						{ cardId: target.id, targetDeckId },
						{
							onSuccess: () => {
								setActiveDialog({ kind: "none" });
								showToast("Card moved.");
								// The breadcrumb (`deckId`, `deckName`) is sourced from this
								// route's server component; refresh re-runs that fetch so the
								// top-bar updates to the new deck without a full reload.
								router.refresh();
							},
						},
					);
				}}
			/>

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

function LoadingBody(): React.JSX.Element {
	return (
		<SectionCard kanji="例" label="Loading">
			<div className="flex items-center justify-center py-8">
				<TomoLoader size="block" />
			</div>
		</SectionCard>
	);
}
