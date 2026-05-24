'use client'

import { useState } from 'react'
import { Card }                  from '@/components/ui/Card'
import { CardStack }             from '@/components/ui/CardStack'
import { RecommendedDeckCard }   from '@/components/ui/RecommendedDeckCard'
import { SelectionCard }         from '@/components/ui/SelectionCard'
import { ToriiGate, BookOpen }   from '@/components/icons/study-marks'
import { ShowcaseGrid, ShowcaseItem } from '../_components/ShowcaseItem'
import { ShowcaseSection }            from '../_components/ShowcaseSection'

const CARD_VARIANTS = ['default', 'compact', 'surface'] as const

export function CardsSection(): React.JSX.Element {
  const [selected,    setSelected]    = useState<string>('travel')
  const [subscribed,  setSubscribed]  = useState(false)
  const [stackTurn,   setStackTurn]   = useState(0)

  return (
    <ShowcaseSection
      id="cards"
      title="Cards"
      description="Card primitive (with variants), SelectionCard, RecommendedDeckCard, CardStack."
    >
      <div>
        <h3 className="text-xs text-faded-sumi mb-3">Card variants</h3>
        <ShowcaseGrid minColumnWidth={320}>
          {CARD_VARIANTS.map(variant => (
            <ShowcaseItem
              key={variant}
              label={`Card / ${variant}`}
              caption={`variant="${variant}"`}
              fill
            >
              <Card variant={variant}>
                <p className="font-display text-base text-sumi-ink mb-1">Sample card</p>
                <p className="text-sm text-faded-sumi">
                  {variant === 'surface'
                    ? 'Nested surface — no top stripe, lighter border.'
                    : 'The default card surface with the vermillion stripe.'}
                </p>
              </Card>
            </ShowcaseItem>
          ))}
          <ShowcaseItem label="Card / noStripe" caption='noStripe' fill>
            <Card noStripe>
              <p className="text-sm text-sumi-ink">Without the identity stripe.</p>
            </Card>
          </ShowcaseItem>
          <ShowcaseItem label="Card / aizome stripe" caption='stripeColor="var(--color-aizome-indigo)"' fill>
            <Card stripeColor="var(--color-aizome-indigo)">
              <p className="text-sm text-sumi-ink">Custom stripe color.</p>
            </Card>
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs text-faded-sumi mb-3">SelectionCard</h3>
        <ShowcaseGrid minColumnWidth={260}>
          <ShowcaseItem label="stack / unselected" caption='layout="stack" selected={false}' fill>
            <SelectionCard
              layout="stack"
              selected={selected === 'travel'}
              onSelect={() => setSelected('travel')}
              glyph={<ToriiGate className="h-7 w-7 text-sumi-ink" />}
              label="Travel"
              description="Phrases for navigating Japan."
            />
          </ShowcaseItem>
          <ShowcaseItem label="stack / selected" caption='selected={true}' fill>
            <SelectionCard
              layout="stack"
              selected={selected === 'work'}
              onSelect={() => setSelected('work')}
              glyph={<BookOpen className="h-7 w-7 text-sumi-ink" />}
              label="Work"
              description="Vocabulary for the office."
            />
          </ShowcaseItem>
          <ShowcaseItem label="inline" caption='layout="inline"' fill>
            <SelectionCard
              layout="inline"
              selected={selected === 'inline'}
              onSelect={() => setSelected('inline')}
              glyph={<BookOpen className="h-5 w-5 text-sumi-ink" />}
              label="Reading goal"
              description="Manga, news, novels."
              trailing={<span className="text-xs text-faded-sumi">N3+</span>}
            />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs text-faded-sumi mb-3">RecommendedDeckCard</h3>
        <ShowcaseGrid minColumnWidth={360}>
          <ShowcaseItem
            label="RecommendedDeckCard"
            caption={`subscribed={${String(subscribed)}}`}
            fill
          >
            <RecommendedDeckCard
              name="Core 2k Vocabulary"
              description="The most common 2,000 Japanese words ranked by frequency."
              level="N4"
              levelLabel="N4"
              count={2000}
              subscribed={subscribed}
              onToggle={() => setSubscribed(prev => !prev)}
            />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs text-faded-sumi mb-3">CardStack</h3>
        <ShowcaseGrid minColumnWidth={360}>
          <ShowcaseItem
            label="CardStack"
            caption={`contentKey="${stackTurn}" cardsBehind={1}`}
            fill
          >
            <div className="flex flex-col gap-3">
              <CardStack contentKey={String(stackTurn)} cardsBehind={1}>
                <Card>
                  <p className="font-display text-lg text-sumi-ink mb-1">Page {stackTurn + 1}</p>
                  <p className="text-sm text-faded-sumi">
                    Click "Turn" below to animate the page transition.
                  </p>
                </Card>
              </CardStack>
              <button
                type="button"
                onClick={() => setStackTurn(prev => prev + 1)}
                className="self-start px-3 py-1.5 text-xs rounded-[2px] bg-cream-inset text-sumi-ink border border-soft-hairline hover:border-faded-sumi"
              >
                Turn
              </button>
            </div>
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>
    </ShowcaseSection>
  )
}
