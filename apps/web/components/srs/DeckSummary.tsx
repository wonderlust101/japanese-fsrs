"use client";

interface DeckSummaryProps {
	/** All decks the user can pick from. Order is preserved in the composition row. */
	allDecks: ReadonlyArray<{
		id: string;
		name: string;
		count: number;
	}>;
	/** IDs of decks the user has subscribed to. */
	subscribedIds: ReadonlySet<string>;
	/** New cards per day from the user's chosen pace (e.g., 20 for steady). */
	paceNewPerDay: number;
	className?: string;
}

/**
 * Beginner-friendly preview of the user's selected starter set.
 *
 * Shows three things, each updating as decks toggle on/off:
 *   1. Total cards — the size of the commitment.
 *   2. Days to learn — concrete time estimate at the user's pace.
 *   3. Composition bar — proportional view of which decks contribute what.
 *
 * Designed to read at a glance for someone who has never used SRS. No
 * abstract scheduling charts; no axes; no jargon.
 */
export function DeckSummary({
	allDecks,
	subscribedIds,
	paceNewPerDay,
	className = "",
}: DeckSummaryProps): React.JSX.Element {
	const subscribedDecks = allDecks.filter(d => subscribedIds.has(d.id));
	const totalCards = subscribedDecks.reduce((sum, d) => sum + d.count, 0);
	const deckCount = subscribedDecks.length;

	// Time estimate at the user's pace. Below ~6 weeks we render in days, above
	// we render in weeks for legibility.
	const days = totalCards > 0 && paceNewPerDay > 0
		? Math.ceil(totalCards / paceNewPerDay)
		: 0;
	const timeLabel = (() => {
		if (days <= 0)
			return null;
		if (days < 14)
			return `${days} ${days === 1 ? "day" : "days"}`;
		if (days < 56)
			return `${Math.round(days / 7)} weeks`;
		if (days < 180)
			return `${Math.round(days / 30)} months`;
		return `${Math.round((days / 365) * 10) / 10} years`;
	})();

	return (
		<div className={["flex flex-col gap-6", className].join(" ")}>
			{/* Total card count. Big number, small label, no chart. */}
			<div className="flex flex-col gap-1">
				<p className="text-sm font-mono text-faded-sumi">
					Cards selected
				</p>
				<p className="ui-motion-colors font-display text-3xl font-semibold text-sumi-ink tabular-nums leading-none">
					{totalCards.toLocaleString()}
				</p>
				<p className="text-xs text-faded-sumi tabular-nums">
					{deckCount > 0
						? `${deckCount} ${deckCount === 1 ? "deck" : "decks"}`
						: "No decks yet"}
				</p>
			</div>

			{/* Time estimate. Concrete days → weeks → months. */}
			<div className="flex flex-col gap-1 pt-4 border-t border-soft-hairline">
				<p className="text-sm font-mono text-faded-sumi">
					Time to learn at
					{" "}
					{paceNewPerDay}
					{" "}
					/ day
				</p>
				<p className="font-display text-xl font-semibold text-sumi-ink tabular-nums leading-[1.1]">
					{timeLabel ?? <span className="text-faded-sumi/60">—</span>}
				</p>
				<p className="text-xs text-faded-sumi">
					From your pace selection. You can change it anytime.
				</p>
			</div>

			{/* Composition bar: each deck contributes a segment proportional to its
          card count. CSS transition on flex-basis means the bar smoothly
          redistributes when decks toggle on or off. Empty state is visible
          (cream rail) so the bar always reads as "your composition lives here." */}
			<div className="flex flex-col gap-2 pt-4 border-t border-soft-hairline">
				<p className="text-sm font-mono text-faded-sumi">
					What's in your set
				</p>

				<div className="relative h-3 bg-cream-inset rounded-xs overflow-hidden flex">
					{allDecks.map((deck, i) => {
						const subscribed = subscribedIds.has(deck.id);
						const fraction = subscribed && totalCards > 0
							? deck.count / totalCards
							: 0;
						return (
							<div
								key={deck.id}
								className="h-full bg-inari-vermillion"
								style={{
									flex: `0 0 ${fraction * 100}%`,
									transition: "flex-basis 420ms var(--ease-out-quint)",
									willChange: "flex-basis",
									borderRight: i < allDecks.length - 1 ? "1px solid var(--color-warm-paper-raised)" : undefined,
								}}
								aria-hidden="true"
							/>
						);
					})}
				</div>

				{deckCount > 0
					? (
							<ul className="flex flex-col gap-1 mt-2">
								{subscribedDecks.map(deck => (
									<li
										key={deck.id}
										className="flex items-center justify-between gap-3 text-xs"
									>
										<span className="text-sumi-ink truncate">{deck.name}</span>
										<span className="text-faded-sumi font-mono tabular-nums whitespace-nowrap">
											{deck.count.toLocaleString()}
											{" "}
											{deck.count === 1 ? "card" : "cards"}
										</span>
									</li>
								))}
							</ul>
						)
					: (
							<p className="text-xs italic text-faded-sumi mt-1">
								Tap a deck to add it. You can add or swap later.
							</p>
						)}
			</div>
		</div>
	);
}
