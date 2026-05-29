"use client";

import type { UserRating } from "@fsrs-japanese/shared-types";
import type { FuriganaMode } from "@/stores/useSessionPreferencesStore";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { OverflowMenu } from "@/app/(app)/review/session/_components/overflow-menu";
import { SessionTeachSheet } from "@/app/(app)/review/session/_components/session-teach-sheet";
import { SessionTopBar } from "@/app/(app)/review/session/_components/session-top-bar";
import { SuspendConfirmDialog } from "@/app/(app)/review/session/_components/suspend-confirm-dialog";
import { IconMore } from "@/components/icons/chrome-marks";
import { SectionCard } from "@/components/ui/SectionCard";
import { Toast, useToast } from "@/components/ui/Toast";
import { getDeckAction } from "@/lib/actions/decks.actions";
import { useSuspendCardMutation } from "@/lib/api/cards";
import { queryKeys } from "@/lib/api/queryKeys";
import { useRatingsPreview } from "@/lib/api/reviews";
import { cn } from "@/lib/utils";
import {
	useCurrentCard,
	useCurrentIndex,
	useReviewQueue,
	useSessionActions,
	useShowAnswer,
} from "@/stores/useReviewSessionStore";
import { useSessionDevOverrides } from "@/stores/useSessionDevOverridesStore";
import {
	useSessionPreferences,
	useSessionPreferencesActions,
} from "@/stores/useSessionPreferencesStore";
import { formatInterval, RatingBar } from "./RatingBar";
import { RevealBar } from "./RevealBar";
import { resolveCardFields } from "./session/card-fields";
import { CardBack } from "./session/CardBack";
import { CardFront } from "./session/CardFront";
import { FrequencyBadge } from "./session/FrequencyBadge";

// Review Session v4 orchestrator.
//
// Three persistent surfaces compose the page:
//   1. SessionTopBar (fixed top, page-scope chrome, learner prefs + session controls)
//   2. Centered SectionCard (the card itself, omitTitle: only stripe + body + in-card ⋯)
//   3. RatingBar (fixed bottom, page-scope decision bar)
//
// The card scrolls internally if its content exceeds the available height
// between top bar and rating bar; top bar and rating bar always stay put.

interface ReviewCardProps {
	/**
	 * Live submission failure from the page-level review mutation. Combined
	 *  with `overrides.forceSyncError` so designers can preview the pill in
	 *  the dev dock without masking a real sync error.
	 */
	liveSyncError?: boolean;
	/**
	 * Whether the most recent rating can still be undone (lives behind the
	 *  page-level 3s deferred-submit timer). When true, `U` triggers `onUndo`.
	 */
	canUndo?: boolean;
	onUndo?: () => void;
	/**
	 * Lifted to the page so end-session can flush any pending review before
	 *  navigating away.
	 */
	onEndSession: () => void;
	/**
	 * Mobile-only confirm escalation: ask the page to open a confirm dialog
	 *  before ending. Unset on the drill session (no confirm needed there).
	 */
	onEndSessionRequest?: () => void;
}

const TEACH_FLAG_KEY = "tomo.session.hasSeenTeach";

export function ReviewCard({ liveSyncError = false, canUndo = false, onUndo, onEndSession, onEndSessionRequest }: ReviewCardProps): React.JSX.Element | null {
	const card = useCurrentCard();
	const queue = useReviewQueue();
	const currentIndex = useCurrentIndex();
	const storeShowAnswer = useShowAnswer();
	const overrides = useSessionDevOverrides();
	const prefs = useSessionPreferences();
	const prefsActions = useSessionPreferencesActions();
	const { flipCard, submitRating } = useSessionActions();
	const queryClient = useQueryClient();

	const suspendMutation = useSuspendCardMutation();
	const { toast, showToast, dismissToast } = useToast();
	const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);

	// Anki-style "what happens if I rate this?" preview. Fetched eagerly while
	// the front is shown so the labels are ready by the time the user flips.
	const ratingsPreviewQuery = useRatingsPreview(card?.id ?? null);
	const nextIntervals = ratingsPreviewQuery.data === undefined
		? undefined
		: {
				again: formatInterval(ratingsPreviewQuery.data.again.scheduledDays),
				hard: formatInterval(ratingsPreviewQuery.data.hard.scheduledDays),
				good: formatInterval(ratingsPreviewQuery.data.good.scheduledDays),
				easy: formatInterval(ratingsPreviewQuery.data.easy.scheduledDays),
			};

	const showAnswer = storeShowAnswer || overrides.forceShowAnswer;

	// Teach sheet: auto-show on the first session a learner ever sees, and
	// available on demand via the `?` button in the top bar. The persisted
	// flag is set once the auto-show is dismissed; manual opens don't touch it.
	const [teachOpen, setTeachOpen] = useState(false);
	const [teachMode, setTeachMode] = useState<"auto" | "manual">("auto");

	useEffect(() => {
		if (typeof window === "undefined")
			return;
		const seen = window.localStorage.getItem(TEACH_FLAG_KEY) === "true";
		if (!seen) {
			setTeachMode("auto"); // eslint-disable-line react/set-state-in-effect -- auto-opens the teach sheet on first session (localStorage gate, mount-only)
			setTeachOpen(true); // eslint-disable-line react/set-state-in-effect -- auto-opens the teach sheet on first session (localStorage gate, mount-only)
		}
	}, []);

	function handleTeachClose(): void {
		setTeachOpen(false);
		if (teachMode === "auto" && typeof window !== "undefined") {
			try { window.localStorage.setItem(TEACH_FLAG_KEY, "true"); } catch { /* private mode etc. */ }
		}
	}

	function handleOpenTeach(): void {
		setTeachMode("manual");
		setTeachOpen(true);
	}

	const deckId = card?.deckId ?? "";
	const { data: deck } = useQuery({
		queryKey: queryKeys.decks.detail(deckId),
		queryFn: () => getDeckAction(deckId),
		enabled: deckId !== "" && deckId !== "fixture-deck",
		staleTime: 1000 * 60 * 30,
	});

	useEffect(() => {
		prefsActions.setActiveDefTab("nuance");
	}, [card?.id, prefsActions]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey)
				return;
			const target = e.target as HTMLElement | null;
			if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
				return;

			// While the teach sheet is open, the sheet's own listener handles
			// dismissal; suppress the rating shortcuts to avoid double-firing.
			if (teachOpen)
				return;

			if ((e.key === "u" || e.key === "U") && canUndo && onUndo !== undefined) {
				e.preventDefault();
				onUndo();
				return;
			}

			if (!showAnswer) {
				if (e.key === " " || e.key === "Enter") {
					e.preventDefault();
					flipCard();
				}
				return;
			}

			const ratingMap: Record<string, UserRating> = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
			const rating = ratingMap[e.key];
			if (rating !== undefined) {
				e.preventDefault();
				submitRating(rating);
				return;
			}

			// Tab toggles: each non-nuance tab cycles back to nuance on re-press.
			// `n` jumps to nuance from anywhere; no toggle target.
			const tabToggleMap: Record<string, string> = {
				n: "nuance",
				m: "mnemonic",
				k: "kanji",
			};
			const tabKey = e.key.toLowerCase();
			const tabTarget = tabToggleMap[tabKey];
			if (tabTarget !== undefined) {
				e.preventDefault();
				if (tabTarget === "nuance") {
					prefsActions.setActiveDefTab("nuance");
				} else {
					prefsActions.setActiveDefTab(prefs.activeDefTab === tabTarget ? "nuance" : tabTarget);
				}
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [showAnswer, flipCard, submitRating, prefsActions, prefs.activeDefTab, teachOpen, canUndo, onUndo]);

	if (card === undefined)
		return null;

	function cycleFurigana(): void {
		const order: FuriganaMode[] = ["hover", "always", "off"];
		const next = order[(order.indexOf(prefs.furiganaMode) + 1) % order.length] ?? "hover";
		prefsActions.setFuriganaMode(next);
	}

	function handleRequestSuspend(): void {
		setSuspendDialogOpen(true);
	}

	function handleConfirmSuspend(): void {
		if (card === undefined)
			return;
		suspendMutation.mutate(card.id, {
			onSuccess: () => {
				setSuspendDialogOpen(false);
				// Card cache invalidator inside the mutation hook only clears
				// cards.* + decks.*; the live review queue lives under reviews.due
				// and needs explicit invalidation so the suspended card disappears
				// on the next fetch.
				void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
				showToast("Card suspended. Won’t appear in reviews until you unsuspend it.", "info");
			},
			onError: () => {
				setSuspendDialogOpen(false);
				showToast("Couldn’t suspend that card. Try again?", "error");
			},
		});
	}

	const total = queue.length;
	const completed = Math.min(currentIndex, total);
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

	const liveOrForcedSyncError = (liveSyncError || overrides.forceSyncError) && !overrides.forceOffline;

	// The card is a constant. One width for every card so a learner sees the
	// same object 50 times in a session — peripheral vision doesn't have to
	// refocus as the deck cycles. The picture+WordStack composition sets the
	// natural ceiling at 960px; bare cards take the same room and let the
	// headword sit in generous paper.
	const fields = resolveCardFields(card);
	const cardMaxW = "max-w-[960px]";

	return (
		<>
			<SessionTopBar
				percentage={percentage}
				positionIndex={currentIndex + 1}
				totalCount={total}
				offline={overrides.forceOffline}
				syncError={liveOrForcedSyncError}
				onEndSession={onEndSession}
				{...(onEndSessionRequest !== undefined ? { onEndSessionRequest } : {})}
				onOpenTeach={handleOpenTeach}
			/>

			<div
				className={cn(
					// Centered horizontally; vertically centered between top bar and
					// rating bar via the layout's flex container.
					"mx-auto flex w-full flex-col px-4 md:px-6",
					cardMaxW,
					// Reserve room below for the fixed rating bar (so the card never
					// hides behind it). The pb here pairs with the layout's overflow-y
					// so the inner card scroll behaves predictably.
					"pb-24 md:pb-28",
					// On mobile, claim the remaining vertical space so the card
					// front fills the viewport between the top bar and the RevealBar.
					// Desktop keeps content-height + parent's justify-center.
					"max-md:flex-1",
				)}
			>
				<SectionCard
					kanji=""
					label=""
					stripeTone="brand"
					omitTitle
					className="max-md:flex max-md:flex-col max-md:flex-1"
				>
					{/* Bonded top row: Frequency badge on the left, ⋯ on the right,
              directly under the vermillion stripe. Replaces the previous
              absolute-positioned ⋯ float so the card has a real chrome
              row anchoring the top edge. FrequencyBadge returns null when
              no rank is present; the ⋯ keeps the row's right anchor in
              either case. */}
					{(showAnswer || fields.frequencyRank !== null) && (
						<div className="flex items-center gap-2 px-1 pt-3 pb-2 md:px-2 md:pt-4 md:pb-2">
							<FrequencyBadge rank={fields.frequencyRank} />
							{showAnswer && (
								<div className="ml-auto">
									<OverflowMenu
										cardId={card.id}
										deckName={deck?.name ?? null}
										audioMuted={prefs.audioMuted}
										onToggleAudio={() => prefsActions.setAudioMuted(!prefs.audioMuted)}
										furiganaMode={prefs.furiganaMode}
										onCycleFurigana={cycleFurigana}
										autoRevealTranslation={prefs.autoRevealTranslation}
										onToggleAutoRevealTranslation={() => prefsActions.setAutoRevealTranslation(!prefs.autoRevealTranslation)}
										onSuspendCard={handleRequestSuspend}
										trigger={(
											<span
												className={cn(
													"inline-flex h-8 w-8 items-center justify-center rounded-xs text-faded-sumi",
													"hover:bg-cream-inset/60 hover:text-sumi-ink transition-colors duration-150",
													"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
												)}
											>
												<IconMore aria-hidden="true" className="w-[17px] h-[17px]" />
											</span>
										)}
									/>
								</div>
							)}
						</div>
					)}
					<div
						className={cn(
							"px-1 pt-5 pb-2 md:px-2 md:pt-7 md:pb-3",
							// On mobile, take the remaining height inside the SectionCard.
							// For the front, also center the (short) content vertically.
							// For the back, leave default top-anchored flow so long content
							// doesn't get its top cut off by justify-center.
							"max-md:flex-1 max-md:flex max-md:flex-col",
							!showAnswer && "max-md:items-center max-md:justify-center",
						)}
					>
						{showAnswer ? <CardBack card={card} /> : <CardFront card={card} />}
					</div>
				</SectionCard>
			</div>

			{showAnswer
				? (
						<RatingBar
							onRate={submitRating}
							{...(nextIntervals !== undefined ? { nextIntervals } : {})}
						/>
					)
				: (
						<RevealBar onReveal={flipCard} />
					)}

			<SessionTeachSheet open={teachOpen} mode={teachMode} onClose={handleTeachClose} />

			<SuspendConfirmDialog
				open={suspendDialogOpen}
				word={fields.word}
				loading={suspendMutation.isPending}
				onClose={() => {
					if (!suspendMutation.isPending)
						setSuspendDialogOpen(false);
				}}
				onConfirm={handleConfirmSuspend}
			/>

			{toast !== null && (
				<Toast
					key={toast.key}
					message={toast.message}
					kind={toast.kind}
					onDismiss={dismissToast}
					offset="above-bar"
				/>
			)}
		</>
	);
}
