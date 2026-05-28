import type { DeckCardCount, MaturityCounts } from "./types";

import { ModuleError } from "@/components/ui/ModuleError";
import { SectionCard } from "@/components/ui/SectionCard";
import { CardsByDeckBar } from "./cards-by-deck-bar";
import { MaturityFlowBar } from "./maturity-flow-bar";
import { STATISTICS_SECTIONS_BY_ID } from "./sections";
import { StatisticsSection } from "./statistics-section";

interface CardsSectionProps {
	maturity: MaturityCounts;
	decks: ReadonlyArray<DeckCardCount>;
	maturityError?: boolean;
	onRetryMaturity?: () => void;
	decksError?: boolean;
	onRetryDecks?: () => void;
}

const SECTION = STATISTICS_SECTIONS_BY_ID.cards;

export function CardsSection({
	maturity,
	decks,
	maturityError = false,
	onRetryMaturity,
	decksError = false,
	onRetryDecks,
}: CardsSectionProps): React.JSX.Element {
	return (
		<StatisticsSection section={SECTION}>
			<div className="flex flex-col gap-y-6 lg:gap-y-6">
				<SectionCard
					kanji="熟"
					label="Maturity flow"
					description="Where cards sit in the SRS lifecycle, from new to mature."
				>
					{maturityError
						? <ModuleError label="the maturity flow" onRetry={onRetryMaturity ?? (() => {})} />
						: <MaturityFlowBar counts={maturity} />}
				</SectionCard>
				<SectionCard
					kanji="束"
					label="Cards by deck"
					description="Each segment sized to the deck's share of the collection."
				>
					{decksError
						? <ModuleError label="your decks" onRetry={onRetryDecks ?? (() => {})} />
						: <CardsByDeckBar decks={decks} />}
				</SectionCard>
			</div>
		</StatisticsSection>
	);
}
