'use client'

import { ContentTypePill, JlptPill, Pill, PillGroup, StatusPill } from '@/components/ui/Pill'
import { ShowcaseGrid, ShowcaseItem } from '../_components/ShowcaseItem'
import { ShowcaseSection }            from '../_components/ShowcaseSection'

const LEVEL_TONES   = ['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt', 'kana'] as const
const STATUS_TONES  = [
  'new',
  'due',
  'learning',
  'review',
  'mastered',
  'leech',
  'suspended',
  'subscribed',
  'premade',
  'success',
  'warning',
  'danger',
  'info',
  'muted',
] as const
const CONTENT_TONES = ['vocabulary', 'kanji', 'grammar', 'sentence', 'mixed', 'kana'] as const
const SIZES         = ['sm', 'md', 'lg'] as const

export function PillsSection(): React.JSX.Element {
  return (
    <ShowcaseSection
      id="pills"
      title="Pill"
      description="Semantic pills use text-first micro-syntax so level, status, and content type never rely on color alone."
    >
      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">JLPT</h3>
        <ShowcaseGrid minColumnWidth={160}>
          {LEVEL_TONES.map(tone => (
            <ShowcaseItem
              key={tone}
              label={`level / ${tone}`}
              caption={`level="${tone}"`}
            >
              <JlptPill level={tone} />
            </ShowcaseItem>
          ))}
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Status</h3>
        <ShowcaseGrid minColumnWidth={180}>
          {STATUS_TONES.map(tone => (
            <ShowcaseItem
              key={tone}
              label={`status / ${tone}`}
              caption={`status="${tone}"`}
            >
              <StatusPill status={tone} />
            </ShowcaseItem>
          ))}
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Content Type</h3>
        <ShowcaseGrid minColumnWidth={180}>
          {CONTENT_TONES.map(tone => (
            <ShowcaseItem
              key={tone}
              label={`content / ${tone}`}
              caption={`type="${tone}"`}
            >
              <ContentTypePill type={tone} />
            </ShowcaseItem>
          ))}
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Groups · Keyboard · Interactive · Sizes</h3>
        <ShowcaseGrid minColumnWidth={200}>
          <ShowcaseItem label="pill group" caption="maxVisible={2}">
            <PillGroup maxVisible={2} compact>
              <JlptPill level="N3" size="sm" />
              <StatusPill status="due" size="sm" />
              <ContentTypePill type="kanji" size="sm" />
              <Pill variant="tag" size="sm">pitch accent</Pill>
            </PillGroup>
          </ShowcaseItem>
          <ShowcaseItem label="tag" caption='variant="tag"'>
            <Pill variant="tag">imported</Pill>
          </ShowcaseItem>
          <ShowcaseItem label="keyboard-key" caption='variant="keyboard-key"'>
            <Pill variant="keyboard-key">⌘ K</Pill>
          </ShowcaseItem>
          <ShowcaseItem label="interactive (off)" caption='variant="interactive" selected={false}'>
            <Pill variant="interactive" selected={false} mark="•" onClick={() => {}}>Tag me</Pill>
          </ShowcaseItem>
          <ShowcaseItem label="interactive (on)" caption='variant="interactive" selected={true}'>
            <Pill variant="interactive" selected mark="•" onClick={() => {}}>Tag me</Pill>
          </ShowcaseItem>
          {SIZES.map(size => (
            <ShowcaseItem
              key={size}
              label={`size / ${size}`}
              caption={`size="${size}"`}
            >
              <StatusPill status="info" size={size} />
            </ShowcaseItem>
          ))}
        </ShowcaseGrid>
      </div>
    </ShowcaseSection>
  )
}
