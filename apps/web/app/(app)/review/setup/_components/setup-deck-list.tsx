"use client";

import type { JlptPillLevel } from "@/components/ui/Pill";
import { Checkbox } from "@/components/ui/Checkbox";
import { JlptPill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";

export interface DeckRow {
	id: string;
	name: string;
	level: JlptPillLevel | null;
	dueCount: number;
}

interface SetupDeckListProps {
	decks: ReadonlyArray<DeckRow>;
	includedDeckIds: ReadonlyArray<string> | null; // null = all
	onToggle: (deckId: string, next: boolean) => void;
}

function isIncluded(
	deckId: string,
	includedDeckIds: ReadonlyArray<string> | null,
): boolean {
	if (includedDeckIds === null)
		return true;
	return includedDeckIds.includes(deckId);
}

export function SetupDeckList({
	decks,
	includedDeckIds,
	onToggle,
}: SetupDeckListProps): React.JSX.Element {
	if (decks.length === 0) {
		return <p className="text-sm text-faded-sumi">No decks yet.</p>;
	}

	return (
		<ul className="divide-y divide-soft-hairline/70 border-t border-soft-hairline/70">
			{decks.map((deck) => {
				const empty = deck.dueCount === 0;
				const included = isIncluded(deck.id, includedDeckIds) && !empty;
				const stateLabel = empty
					? "no cards due"
					: included
						? "Studying"
						: "Skip";
				// Row is a delegating wrapper, not an interactive element. The
				// Checkbox inside is the only tab stop and the only ARIA-announced
				// control (`role="checkbox"` + `aria-checked`). Clicking anywhere on
				// the row proxies to the Checkbox's onChange so the entire row is a
				// tap target without nesting a <button> inside another <button>.
				function handleRowClick(e: React.MouseEvent<HTMLDivElement>): void {
					if (empty)
						return;
					// Skip when the click already originated inside the Checkbox button
					// (it handles its own toggle), otherwise we'd flip twice.
					const target = e.target as HTMLElement;
					if (target.closest("[role=\"checkbox\"]"))
						return;
					onToggle(deck.id, !included);
				}
				return (
					<li key={deck.id}>
						<div
							// role="presentation" makes the row's a11y semantics
							// explicit: this <div> is delegating chrome that proxies
							// clicks to the embedded Checkbox. Screen readers continue
							// to announce only the Checkbox, which is the actual
							// control. Future maintainers shouldn't try to convert this
							// into a <button> (would nest with the Checkbox button).
							role="presentation"
							onClick={handleRowClick}
							className={cn(
								// Two-line layout: deck name on line 1, meta cluster on
								// line 2. items-start keeps the Checkbox anchored to the
								// top so it visually pairs with the title rather than
								// floating between the two lines.
								"flex w-full items-start gap-4 px-1 py-3 text-left min-h-[64px]",
								"rounded-xs transition-colors duration-150 ease-out",
								"has-[[role=checkbox]:focus-visible]:outline has-[[role=checkbox]:focus-visible]:outline-2 has-[[role=checkbox]:focus-visible]:outline-sumi-ink has-[[role=checkbox]:focus-visible]:outline-offset-2",
								empty
									? "cursor-not-allowed"
									: "cursor-pointer hover:bg-cream-inset/60",
							)}
						>
							{/* pt-0.5 optical nudge puts the Checkbox on the title's
                  baseline rather than the row's absolute top edge. */}
							<div className="pt-0.5">
								<Checkbox
									checked={included}
									onChange={next => onToggle(deck.id, next)}
									ariaLabel={`Include ${deck.name}`}
									disabled={empty}
								/>
							</div>

							{/* Title + meta stacked vertically. Title takes the full
                  width of the row; meta sits beneath as a separate
                  cluster with the state label right-anchored to keep a
                  consistent scan column across rows. */}
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<p
									className={cn(
										"min-w-0 text-base leading-snug line-clamp-2",
										empty ? "text-faded-sumi" : "text-sumi-ink",
									)}
								>
									{deck.name}
								</p>

								<div className="flex items-center gap-2 min-w-0">
									{deck.level !== null && (
										<JlptPill level={deck.level} size="sm" />
									)}
									<p className="shrink-0 font-mono tabular-nums text-sm text-faded-sumi">
										{empty ? "0 due" : `${deck.dueCount} due`}
									</p>

									<p
										className={cn(
											// Spacer pushes the state label to the right edge
											// of line 2 without needing justify-between (which
											// would also separate pill from due-count).
											"ml-auto shrink-0 font-mono text-sm tabular-nums",
											"min-w-[5.5rem] text-right",
											empty
												? "text-faded-sumi"
												: included
													? "text-inari-vermillion-deep"
													: "text-faded-sumi",
										)}
									>
										{stateLabel}
									</p>
								</div>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
