"use client";

import type { CreateDrillSessionInput } from "@/lib/actions/weak-spots.actions";
import { useRouter, useSearchParams } from "next/navigation";

import { useState } from "react";
import { MobileStickyActionBar } from "@/app/(app)/_components/mobile-sticky-action-bar";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuietLink } from "@/components/ui/QuietLink";
import { Radio } from "@/components/ui/Radio";
import { SectionCard } from "@/components/ui/SectionCard";
import { useWeakSpotDrillSetupDevState } from "@/dev/panels/weak-spot-drill-setup";
import { useDecks } from "@/lib/api/decks";
import {
	useCreateDrillSessionMutation,
	useWeakSpotsQuery,
} from "@/lib/api/weak-spots";

import { cn } from "@/lib/utils";

// ── Source picker shapes ──────────────────────────────────────────────────────

type DrillSource
	= | { kind: "unresolvedLeeches" }
		| { kind: "deckScoped"; deckId: string }
		| { kind: "highLapseCandidates"; minLapses: number }
		| { kind: "currentCard"; cardId: string };

type LimitOption = 5 | 10 | 20;

const LIMIT_OPTIONS: ReadonlyArray<LimitOption> = [5, 10, 20];

// ── Page ──────────────────────────────────────────────────────────────────────
//
// Visual 1-to-1 copy of `/review/setup`. Same outer flex / inner grid
// scaffolding, same PageHeader, same sticky-aside summary + right-column
// SectionCards layout, same MobileStickyActionBar pattern. The drill-only
// differences are:
//
//   - The aside summary (`DrillSetupSummary`) reports estimated cards, source
//     label, and limit — drill doesn't have a queue breakdown the way review
//     does, and doesn't budget by seconds.
//   - Right-column control cards are Source + Session size (3-row source
//     picker + 3-chip limit picker) instead of review's deck list + tuning
//     controls.
//
// `?cardId=` deeplinks the current-card flow so the Drill button on a
// weak-spot row routes straight to a one-card session entry point.

export function DrillSetupClient(): React.JSX.Element {
	const router = useRouter();
	const searchParams = useSearchParams();
	const deeplinkCardId = searchParams.get("cardId");

	const [source, setSource] = useState<DrillSource>(
		deeplinkCardId !== null
			? { kind: "currentCard", cardId: deeplinkCardId }
			: { kind: "unresolvedLeeches" },
	);
	const [limit, setLimit] = useState<LimitOption>(10);

	useWeakSpotDrillSetupDevState();

	const decksQuery = useDecks(50);
	const decks = decksQuery.data?.items ?? [];

	// The offset contract returns the full `totalCount` independent of the page
	// window, so a `limit: 1` probe is enough to learn the exact pile size — no
	// need to fetch 50 rows just to count them, and no `N+` overflow label.
	const weakSpotsQuery = useWeakSpotsQuery({ status: "unresolved", limit: 1 });
	const unresolvedCount = weakSpotsQuery.data?.totalCount ?? 0;
	const unresolvedLabel
		= unresolvedCount === 0
			? "No unresolved weak spots right now"
			: `${unresolvedCount} unresolved ${unresolvedCount === 1 ? "weak spot" : "weak spots"} in your pile`;

	const createMutation = useCreateDrillSessionMutation();

	const estimatedCards = estimateSize(source, unresolvedCount, limit);
	const canStart = !createMutation.isPending && estimatedCards > 0;

	function handleStart(): void {
		const input = buildPayload(source, limit);
		createMutation.mutate(input, {
			onSuccess: (session) => {
				router.push(`/weak-spots/drill/${session.sessionId}`);
			},
		});
	}

	const startLabel = estimatedCards === 0
		? "Nothing to drill"
		: `Start drill · up to ${Math.min(limit, estimatedCards)} ${Math.min(limit, estimatedCards) === 1 ? "card" : "cards"}`;

	// Action area is shared between the desktop sticky aside and the mobile
	// sticky action bar, exactly as review setup does it.
	const actions = (
		<ActionArea
			canStart={canStart}
			startLabel={startLabel}
			onStart={handleStart}
			pending={createMutation.isPending}
			error={createMutation.isError ? (createMutation.error?.message ?? "Couldn’t start that drill.") : null}
		/>
	);

	return (
		<PageFrame desktopCentered>
			<PageHeader
				kanji="弱"
				label="Drill setup"
				title="Practice your weak spots."
				subtitle="A focused, schedule-safe drill. Your review timing stays exactly as it is."
			/>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10">
				<aside className="lg:col-span-5 lg:sticky lg:top-10 lg:self-start">
					<DrillSetupSummary
						estimated={estimatedCards}
						limit={limit}
						actions={actions}
					/>
				</aside>

				<div className="lg:col-span-7">
					<div className="flex flex-col gap-y-6">
						<SectionCard
							id="drill-source"
							kanji="源"
							label="Source"
							description="Which cards should this drill pull from?"
							variant="compact"
						>
							<fieldset className="flex flex-col gap-2">
								<legend className="sr-only">Drill source</legend>
								<SourceOption
									checked={source.kind === "unresolvedLeeches"}
									onSelect={() => setSource({ kind: "unresolvedLeeches" })}
									label="Unresolved weak spots"
									description={unresolvedLabel}
								/>
								<SourceOption
									checked={source.kind === "deckScoped"}
									onSelect={() =>
										setSource(prev =>
											prev.kind === "deckScoped"
												? prev
												: { kind: "deckScoped", deckId: decks[0]?.id ?? "" },
										)}
									label="Deck-scoped"
									description="Only weak spots in a deck you pick"
								>
									{source.kind === "deckScoped" && (
										<select
											aria-label="Deck"
											value={source.deckId}
											onChange={e =>
												setSource({ kind: "deckScoped", deckId: e.currentTarget.value })}
											className="mt-3 w-full max-w-[20rem] rounded-xs border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-sm text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
										>
											{decks.length === 0 && (
												<option value="">No decks yet</option>
											)}
											{decks.map(d => (
												<option key={d.id} value={d.id}>{d.name}</option>
											))}
										</select>
									)}
								</SourceOption>
								<SourceOption
									checked={source.kind === "highLapseCandidates"}
									onSelect={() =>
										setSource(prev =>
											prev.kind === "highLapseCandidates" ? prev : { kind: "highLapseCandidates", minLapses: 3 },
										)}
									label="High-lapse candidates"
									description="Cards near the weak-spot threshold, even if not flagged yet"
								>
									{source.kind === "highLapseCandidates" && (
										<div className="mt-3 flex items-center gap-2 font-mono text-sm text-faded-sumi">
											<span>Minimum lapses</span>
											<input
												type="number"
												min={1}
												max={20}
												value={source.minLapses}
												onChange={(e) => {
													const next = Number.parseInt(e.currentTarget.value, 10);
													if (!Number.isFinite(next))
														return;
													setSource({ kind: "highLapseCandidates", minLapses: Math.min(20, Math.max(1, next)) });
												}}
												className="h-8 w-16 rounded-xs border border-soft-hairline bg-warm-paper-raised px-2 text-center text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
											/>
										</div>
									)}
								</SourceOption>
								{deeplinkCardId !== null && (
									<SourceOption
										checked={source.kind === "currentCard"}
										onSelect={() => setSource({ kind: "currentCard", cardId: deeplinkCardId })}
										label="Just this card"
										description="A focused single-card drill from where you came from"
									/>
								)}
							</fieldset>
						</SectionCard>

						<SectionCard
							id="drill-limit"
							kanji="量"
							label="Session size"
							description="Keep it bounded. You can always run another."
							variant="compact"
						>
							<div
								role="radiogroup"
								aria-label="Session size"
								className="flex flex-wrap gap-2"
							>
								{LIMIT_OPTIONS.map((opt) => {
									const active = opt === limit;
									return (
										<button
											key={opt}
											type="button"
											role="radio"
											aria-checked={active}
											onClick={() => setLimit(opt)}
											className={cn(
												"min-w-[5rem] rounded-xs border px-4 py-2",
												"font-mono text-sm",
												"transition-colors",
												"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
												active
													? "border-inari-vermillion bg-vermillion-wash text-inari-vermillion-deep"
													: "border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-sumi-ink hover:text-sumi-ink",
											)}
										>
											{opt}
											{" "}
											cards
										</button>
									);
								})}
							</div>
							<p className="mt-3 max-w-measure text-sm leading-relaxed text-faded-sumi">
								Missed cards return later in the same session after a small lag.
							</p>
						</SectionCard>
					</div>
				</div>
			</div>

			<MobileStickyActionBar ariaLabel="Start drill session">
				{actions}
			</MobileStickyActionBar>
		</PageFrame>
	);
}

// ── Sticky aside summary ─────────────────────────────────────────────────────

interface DrillSetupSummaryProps {
	estimated: number;
	limit: LimitOption;
	actions: React.ReactNode;
}

// Mirrors `SetupSummary`'s SectionCard chrome and rhythm — description in
// the card header (not a body paragraph), two PrimaryStats on a baseline,
// then the desktop action area. The picked source is already obvious from
// the radio selection in the right column, so it isn't restated here.

function DrillSetupSummary({
	estimated,
	limit,
	actions,
}: DrillSetupSummaryProps): React.JSX.Element {
	return (
		<SectionCard
			id="drill-setup-summary"
			kanji="弱"
			label="This drill"
			description="Practice only. Your review schedule stays exactly as it is."
		>
			<dl
				className={cn(
					"mt-6",
					"grid grid-cols-1 sm:grid-cols-2",
					"gap-x-6 gap-y-4",
				)}
				aria-live="polite"
			>
				<PrimaryStat
					label="Cards"
					value={estimated === 0 ? "0" : String(estimated)}
					suffix={estimated === 1 ? "card" : "cards"}
				/>
				<PrimaryStat label="Limit" value={String(limit)} />
			</dl>

			<div className="mt-6 hidden lg:block">
				{actions}
			</div>
		</SectionCard>
	);
}

function PrimaryStat({
	label,
	value,
	suffix,
}: {
	label: string;
	value: string;
	suffix?: string;
}): React.JSX.Element {
	return (
		<div className="flex items-baseline gap-2 min-w-0 sm:justify-self-start">
			<dt className="font-mono text-sm text-faded-sumi">
				{label}
			</dt>
			<dd className="flex items-baseline gap-2 min-w-0">
				<span className="font-display text-stat tabular-nums text-sumi-ink">
					{value}
				</span>
				{suffix !== undefined && (
					<span className="font-display text-sm text-faded-sumi">
						{suffix}
					</span>
				)}
			</dd>
		</div>
	);
}

// ── Action area ──────────────────────────────────────────────────────────────

interface ActionAreaProps {
	canStart: boolean;
	startLabel: string;
	onStart: () => void;
	pending: boolean;
	error: string | null;
}

function ActionArea({
	canStart,
	startLabel,
	onStart,
	pending,
	error,
}: ActionAreaProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="primary"
					size="lg"
					onClick={onStart}
					loading={pending}
					disabled={!canStart}
				>
					{startLabel}
				</Button>
				<QuietLink href="/weak-spots" tone="sumi" size="sm">
					Cancel
				</QuietLink>
			</div>
			{error !== null && (
				<p role="alert" className="text-sm text-error-deep">{error}</p>
			)}
		</div>
	);
}

// ── Source option ────────────────────────────────────────────────────────────

interface SourceOptionProps {
	checked: boolean;
	onSelect: () => void;
	label: string;
	description: string;
	children?: React.ReactNode;
}

function SourceOption({
	checked,
	onSelect,
	label,
	description,
	children,
}: SourceOptionProps): React.JSX.Element {
	return (
		<label
			className={cn(
				"group flex cursor-pointer flex-col rounded-xs border px-4 py-3 transition-colors",
				"has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-sumi-ink has-[:focus-visible]:outline-offset-2",
				checked
					? "border-inari-vermillion bg-vermillion-wash/40"
					: "border-soft-hairline hover:border-faded-sumi",
			)}
		>
			<span className="flex items-start gap-3">
				<input
					type="radio"
					name="drill-source"
					checked={checked}
					onChange={onSelect}
					className="sr-only"
				/>
				<span className="mt-1">
					<Radio checked={checked} className="group-hover:border-faded-sumi" />
				</span>
				<span className="flex-1">
					<span className="block text-sm font-medium text-sumi-ink">{label}</span>
					<span className="mt-0.5 block text-sm leading-snug text-faded-sumi">
						{description}
					</span>
				</span>
			</span>
			{checked && children !== undefined && <div className="ml-7">{children}</div>}
		</label>
	);
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function buildPayload(source: DrillSource, limit: LimitOption): CreateDrillSessionInput {
	if (source.kind === "unresolvedLeeches") {
		return { source: "unresolvedLeeches", limit, repeatPolicy: "missedAfterLag", order: "mostLapses" };
	}
	if (source.kind === "deckScoped") {
		return {
			source: "deckScoped",
			deckId: source.deckId,
			limit,
			repeatPolicy: "missedAfterLag",
			order: "mostLapses",
		};
	}
	if (source.kind === "highLapseCandidates") {
		return {
			source: "highLapseCandidates",
			minLapses: source.minLapses,
			limit,
			repeatPolicy: "missedAfterLag",
			order: "mostLapses",
		};
	}
	return {
		source: "currentCard",
		cardId: source.cardId,
		limit,
		repeatPolicy: "missedAfterLag",
	};
}

function estimateSize(
	source: DrillSource,
	unresolvedCount: number,
	limit: LimitOption,
): number {
	if (source.kind === "unresolvedLeeches")
		return Math.min(unresolvedCount, limit);
	if (source.kind === "currentCard")
		return 1;
	return limit;
}
