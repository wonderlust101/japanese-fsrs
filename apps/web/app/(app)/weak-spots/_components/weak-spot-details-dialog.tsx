"use client";

import type { ApiWeakSpotListItem } from "@fsrs-japanese/shared-types";

import type { JlptPillLevel } from "@/components/ui/Pill";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FuriganaText } from "@/components/ui/FuriganaText";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { Time } from "@/components/ui/Time";

import { WeakSpotDiagnosisPanel } from "./weak-spot-diagnosis-panel";
import { WEAK_SPOT_DRILL_ENABLED } from "./weak-spots-types";

interface WeakSpotDetailsDialogProps {
	open: boolean;
	onClose: () => void;
	weakSpot: ApiWeakSpotListItem | undefined;
	isLoading: boolean;
	isError: boolean;
	errorMessage?: string;
	onResolve: (id: string) => void;
	onReopen: (id: string) => void;
	onDiagnose: (id: string) => void;
	isResolving: boolean;
	isReopening: boolean;
	isDiagnosing: boolean;
	diagnoseError: string | undefined;
}

/**
 * WeakSpot detail surface. Uses the `Dialog` primitive — already brand-aligned
 * with eyebrow + kanji + 2px vermillion top stripe — at the `xl` tier so
 * the card content + FSRS state strip + diagnosis panel all fit without
 * scrolling on a typical viewport.
 *
 * The Dialog stays mounted (open false) when no weakSpot is selected, but the
 * caller passes `weakSpot: undefined` and `isLoading: false` in that case so
 * the body short-circuits to null without firing any query. The detail
 * query in `useWeakSpotDetailQuery` is also `enabled`-gated on the id.
 */
export function WeakSpotDetailsDialog({
	open,
	onClose,
	weakSpot,
	isLoading,
	isError,
	errorMessage,
	onResolve,
	onReopen,
	onDiagnose,
	isResolving,
	isReopening,
	isDiagnosing,
	diagnoseError,
}: WeakSpotDetailsDialogProps): React.JSX.Element {
	const router = useRouter();

	return (
		<Dialog
			open={open}
			onClose={onClose}
			// `title` omitted on purpose: the eyebrow is promoted to the heading, so
			// the word isn't repeated in the chrome and again in the card facsimile
			// below. The card facsimile is the single place the word appears.
			eyebrow={{ kanji: "弱", label: "Weak spot" }}
			size="xl"
		>
			{isLoading || weakSpot === undefined ? (
				<DetailSkeleton />
			) : isError ? (
				<div
					role="alert"
					className="rounded-xs border border-error/30 bg-error-tint/40 px-4 py-4 text-sm text-error-deep"
				>
					<p>Couldn&rsquo;t load this card right now.</p>
					{errorMessage !== undefined && (
						<p className="mt-1 text-error-deep/80">{errorMessage}</p>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-y-6">
					{/* Hero card facsimile: the only place the word appears. Carries the
              word + reading, JLPT pill, and the Status pill (top-right), with
              meaning and deck as supporting context — Deck and Status leave the
              stats grid and live here as card identity. */}
					<section
						aria-label="Card content"
						className="rounded-xs border border-soft-hairline bg-cream-inset/45 px-4 py-4 sm:px-5 sm:py-5"
					>
						<div className="flex items-start justify-between gap-4">
							<div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
								<span className="font-display text-2xl text-sumi-ink sm:text-[1.625rem]">
									{weakSpot.word !== null && weakSpot.reading !== null
										? (
												<FuriganaText text={weakSpot.word} reading={weakSpot.reading} />
											)
										: (
												<span className="italic text-faded-sumi">Card no longer exists</span>
											)}
								</span>
								{weakSpot.jlptLevel !== null && (
									<Pill variant="level" tone={jlptPillTone(weakSpot.jlptLevel)} size="sm">
										{weakSpot.jlptLevel === "beyond_jlpt" ? "Beyond" : weakSpot.jlptLevel}
									</Pill>
								)}
							</div>
							<StatusPill resolved={weakSpot.resolved} />
						</div>
						{weakSpot.meaning !== null && (
							<p className="mt-2 text-base text-sumi-ink/85">{weakSpot.meaning}</p>
						)}
						{weakSpot.deckName !== null && (
							<p className="mt-2 font-mono text-sm normal-case tracking-normal text-faded-sumi">
								{weakSpot.deckName}
							</p>
						)}
					</section>

					{/* Card state, grouped into two labeled clusters so the seven equal
              cells gain hierarchy (severity-tinted lapses lead) and rhythm
              (generous gap between clusters, tighter within). */}
					<section aria-label="Card state" className="flex flex-col gap-5 border-y border-soft-hairline py-5">
						<StatCluster title="Progress">
							<Stat
								label="Lapses"
								value={weakSpot.lapses === null ? "—" : String(weakSpot.lapses)}
								tone={!weakSpot.resolved && (weakSpot.lapses ?? 0) >= LEECH_THRESHOLD ? "severe" : "default"}
							/>
							<Stat label="Reps" value={weakSpot.reps === null ? "—" : String(weakSpot.reps)} />
						</StatCluster>
						<StatCluster title="Schedule">
							<Stat label="Last review" value={formatDate(weakSpot.lastReview)} dateTime={weakSpot.lastReview} />
							<Stat label="Due" value={formatDate(weakSpot.due)} dateTime={weakSpot.due} />
							<Stat label="Flagged" value={formatDate(weakSpot.createdAt)} dateTime={weakSpot.createdAt} />
						</StatCluster>
					</section>

					{/* Diagnosis */}
					<WeakSpotDiagnosisPanel
						diagnosis={weakSpot.diagnosis}
						prescription={weakSpot.prescription}
						isLoading={isDiagnosing}
						isError={diagnoseError !== undefined}
						{...(diagnoseError !== undefined ? { errorMessage: diagnoseError } : {})}
						onDiagnose={() => onDiagnose(weakSpot.id)}
						onRetry={() => onDiagnose(weakSpot.id)}
					/>

					{/* Footer actions */}
					<footer className="flex flex-wrap items-center justify-between gap-3 border-t border-soft-hairline pt-5">
						<div className="flex flex-wrap items-center gap-2">
							{WEAK_SPOT_DRILL_ENABLED && !weakSpot.resolved && weakSpot.cardId !== null && (
								<Button
									type="button"
									variant="primary"
									size="sm"
									className="min-h-11 sm:min-h-0"
									onClick={() =>
										router.push(`/weak-spots/drill/setup?cardId=${weakSpot.cardId}`)}
								>
									Drill this card
								</Button>
							)}
							{weakSpot.cardId !== null && (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="min-h-11 sm:min-h-0"
									onClick={() => router.push(`/cards/${weakSpot.cardId}`)}
								>
									Open card
								</Button>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{!weakSpot.resolved
								? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="min-h-11 sm:min-h-0"
											onClick={() => onResolve(weakSpot.id)}
											loading={isResolving}
											disabled={weakSpot.cardId === null}
										>
											Mark resolved
										</Button>
									)
								: (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="min-h-11 sm:min-h-0"
											onClick={() => onReopen(weakSpot.id)}
											loading={isReopening}
										>
											Reopen
										</Button>
									)}
						</div>
					</footer>
				</div>
			)}
		</Dialog>
	);
}

// ─── Clusters / stats / status / skeleton / helpers ──────────────────────────

// Lapse-count threshold treated as a leech; mirrors the backend
// `LEECH_THRESHOLD` default (8). Used only to tint the lapse value.
const LEECH_THRESHOLD = 8;

/**
 * A labeled group of stats. The small uppercase subhead gives the section
 * typographic hierarchy; stats lay out in a wrapping row with generous
 * column spacing.
 */
function StatCluster({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
	return (
		<div>
			<p className="font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi/80">{title}</p>
			<div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">{children}</div>
		</div>
	);
}

interface StatProps {
	label: string;
	value: string;
	/** When set, the value is wrapped in a semantic <time datetime> element. */
	dateTime?: string | null;
	/** 'severe' tints the value vermillion for at/over-threshold lapses. */
	tone?: "default" | "severe";
	normalCase?: boolean;
}

function Stat({ label, value, dateTime, tone = "default", normalCase = false }: StatProps): React.JSX.Element {
	return (
		<div>
			<p className="text-sm text-faded-sumi">{label}</p>
			<p
				className={[
					"mt-1 font-mono text-base",
					tone === "severe" ? "text-inari-vermillion-deep" : "text-sumi-ink",
					normalCase ? "tracking-normal normal-case" : "tabular-nums",
				].join(" ")}
			>
				{dateTime != null ? <Time value={dateTime}>{value}</Time> : value}
			</p>
		</div>
	);
}

/**
 * Status as a colored pill: amber while unresolved (needs attention), indigo
 * once resolved. The indigo matches the list row's Resolved badge so the two
 * surfaces agree.
 */
function StatusPill({ resolved }: { resolved: boolean }): React.JSX.Element {
	return (
		<span
			className={[
				"inline-flex shrink-0 items-center rounded-xs border px-2 py-0.5 font-mono text-sm",
				resolved
					? "border-aizome-indigo/30 bg-aizome-indigo/10 text-aizome-indigo"
					: "border-deck-beyond-mark/30 bg-deck-beyond-wash text-deck-beyond-mark",
			].join(" ")}
		>
			{resolved ? "Resolved" : "Unresolved"}
		</span>
	);
}

function DetailSkeleton(): React.JSX.Element {
	return (
		<div aria-busy="true" aria-label="Loading weak spot" className="flex flex-col gap-y-6">
			<Skeleton className="h-28 w-full" />
			<div className="flex flex-col gap-5 py-1">
				<div className="flex gap-8">
					<Skeleton className="h-10 w-16" />
					<Skeleton className="h-10 w-16" />
				</div>
				<div className="flex gap-8">
					<Skeleton className="h-10 w-24" />
					<Skeleton className="h-10 w-24" />
					<Skeleton className="h-10 w-24" />
				</div>
			</div>
			<Skeleton className="h-28 w-full" />
		</div>
	);
}

function jlptPillTone(level: string): JlptPillLevel {
	if (level === "N1" || level === "N2" || level === "N3" || level === "N4" || level === "N5") {
		return level;
	}
	return "beyond_jlpt";
}

function formatDate(iso: string | null): string {
	if (iso === null)
		return "—";
	const ms = Date.parse(iso);
	if (Number.isNaN(ms))
		return "—";
	const d = new Date(ms);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
