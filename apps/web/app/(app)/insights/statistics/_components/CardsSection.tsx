import { SectionCard } from '@/components/ui/SectionCard'

import { CardsByDeckBar } from './CardsByDeckBar'
import { MaturityFlowBar } from './MaturityFlowBar'
import { STATISTICS_SECTIONS_BY_ID } from './sections'
import { StatisticsSection } from './StatisticsSection'
import type { DeckCardCount, MaturityCounts } from './types'

interface CardsSectionProps {
  maturity: MaturityCounts
  decks:    ReadonlyArray<DeckCardCount>
}

const SECTION = STATISTICS_SECTIONS_BY_ID.cards

export function CardsSection({
  maturity,
  decks,
}: CardsSectionProps): React.JSX.Element {
  return (
    <StatisticsSection section={SECTION}>
      <div className="flex flex-col gap-y-6 lg:gap-y-7">
        <SectionCard
          kanji="札"
          label="Maturity flow"
          description="Where cards sit in the SRS lifecycle, from new to mature."
        >
          <MaturityFlowBar counts={maturity} />
        </SectionCard>
        <SectionCard
          kanji="束"
          label="Cards by deck"
          description="Each segment sized to the deck's share of the collection."
        >
          <CardsByDeckBar decks={decks} />
        </SectionCard>
      </div>
    </StatisticsSection>
  )
}
