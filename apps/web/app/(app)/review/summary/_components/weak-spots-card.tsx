import type { SessionWeakSpot } from "@fsrs-japanese/shared-types";

import { WeakSpotRow } from "@/components/review/summary/WeakSpotRow";
import { SectionCard } from "@/components/ui/SectionCard";

import { FIXTURE_MEANINGS } from "./summary-fixtures";

// Lapses-first ordering with recency as the tiebreaker. The list is now
// primarily a "what's failing hardest" view; within an identical lapse
// count, newer weak spots float above older ones so a learner can still
// tell what just slipped vs. what has been failing for weeks. Legacy
// payloads without `lapses` sort to the bottom (treated as 0).
function sortedWeakSpots(weakSpots: SessionWeakSpot[]): SessionWeakSpot[] {
	return [...weakSpots].sort((a, b) => {
		const aLapses = a.lapses ?? 0;
		const bLapses = b.lapses ?? 0;
		if (aLapses !== bLapses)
			return bLapses - aLapses;
		const aTime = Date.parse(a.createdAt);
		const bTime = Date.parse(b.createdAt);
		return bTime - aTime;
	});
}

/**
 * Session-close card listing the weak spots *triggered this session*, ordered
 * by lapse count (the tier explainer maps Mark / Drift / Weak to lapse ranges).
 * Each row can roll back its own review when a log id is available and it
 * hasn't already been rolled back. Distinct from the cumulative-backlog nudge.
 */
export function WeakSpotsCard({
	weakSpots,
	usingFixture,
	reviewLogByCardId,
	rolledBackIds,
	rollbackPendingCardId,
	onRollback,
}: {
	weakSpots: SessionWeakSpot[];
	usingFixture: boolean;
	reviewLogByCardId: ReadonlyMap<string, string>;
	rolledBackIds: ReadonlySet<string>;
	rollbackPendingCardId: string | null;
	onRollback: (weakSpot: SessionWeakSpot) => void;
}): React.JSX.Element {
	return (
		<SectionCard
			id="summary-weak-spots"
			kanji="困"
			label="Weak spots"
			description="Cards that keep slipping. Ordered by lapse count."
			count={weakSpots.length}
			stripeTone="error"
			kanjiTone="error"
			className="flex h-full flex-col"
		>
			{/* Tier-system explainer. Always-visible mono caption sitting just
             above the row list. Teaches the kanji-and-label combination so
             a first-time viewer doesn't have to infer Mark / Drift / Weak
             from lapse counts alone. `tabular-nums` keeps the ranges aligned
             across the three groups. */}
			<p
				aria-hidden="true"
				className="mt-3 font-mono text-sm text-faded-sumi tabular-nums"
			>
				<span className="text-sumi-ink">Mark</span>
				{" "}
				· 1–3 lapses
				<span className="mx-3 text-faded-sumi/60">·</span>
				<span className="text-warning">Drift</span>
				{" "}
				· 4–7
				<span className="mx-3 text-faded-sumi/60">·</span>
				<span className="text-inari-vermillion-deep">Weak</span>
				{" "}
				· 8+
			</p>

			<div className="mt-3 max-h-[22rem] overflow-y-auto pr-1">
				<ul className="flex flex-col gap-2">
					{sortedWeakSpots(weakSpots).map((weakSpot) => {
						const logId = reviewLogByCardId.get(weakSpot.cardId);
						const alreadyRolled = rolledBackIds.has(weakSpot.cardId);
						const canRollback = logId !== undefined && !alreadyRolled;
						const rollbackPending = rollbackPendingCardId === logId;
						return (
							<li key={weakSpot.weakSpotId}>
								<WeakSpotRow
									weakSpot={weakSpot}
									meaning={process.env.NODE_ENV === "development" && usingFixture ? FIXTURE_MEANINGS[weakSpot.cardId] : undefined}
									onRollback={canRollback ? onRollback : undefined}
									rollbackPending={rollbackPending}
								/>
							</li>
						);
					})}
				</ul>
			</div>
		</SectionCard>
	);
}
