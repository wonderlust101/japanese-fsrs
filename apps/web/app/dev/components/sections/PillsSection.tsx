'use client'

import { Pill } from '@/components/ui/Pill'
import { ShowcaseGrid, ShowcaseItem } from '../_components/ShowcaseItem'
import { ShowcaseSection }            from '../_components/ShowcaseSection'

const LEVEL_TONES  = ['N5', 'N4', 'N3', 'N2', 'N1', 'beyond', 'kana'] as const
const STATUS_TONES = ['success', 'warning', 'danger', 'info', 'muted'] as const
const SIZES        = ['sm', 'md', 'lg'] as const

export function PillsSection(): React.JSX.Element {
  return (
    <ShowcaseSection
      id="pills"
      title="Pill"
      description="Five variants (level, tag, status, keyboard-key, interactive) × three sizes."
    >
      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Level</h3>
        <ShowcaseGrid minColumnWidth={160}>
          {LEVEL_TONES.map(tone => (
            <ShowcaseItem
              key={tone}
              label={`level / ${tone}`}
              caption={`variant="level" tone="${tone}"`}
            >
              <Pill variant="level" tone={tone}>{tone === 'kana' ? 'Kana' : tone}</Pill>
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
              caption={`variant="status" tone="${tone}"`}
            >
              <Pill variant="status" tone={tone}>{tone}</Pill>
            </ShowcaseItem>
          ))}
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Tag · Keyboard · Interactive · Sizes</h3>
        <ShowcaseGrid minColumnWidth={200}>
          <ShowcaseItem label="tag" caption='variant="tag"'>
            <Pill variant="tag">imported</Pill>
          </ShowcaseItem>
          <ShowcaseItem label="keyboard-key" caption='variant="keyboard-key"'>
            <Pill variant="keyboard-key">⌘ K</Pill>
          </ShowcaseItem>
          <ShowcaseItem label="interactive (off)" caption='variant="interactive" selected={false}'>
            <Pill variant="interactive" selected={false} onClick={() => {}}>Tag me</Pill>
          </ShowcaseItem>
          <ShowcaseItem label="interactive (on)" caption='variant="interactive" selected={true}'>
            <Pill variant="interactive" selected onClick={() => {}}>Tag me</Pill>
          </ShowcaseItem>
          {SIZES.map(size => (
            <ShowcaseItem
              key={size}
              label={`size / ${size}`}
              caption={`size="${size}"`}
            >
              <Pill variant="status" tone="info" size={size}>info</Pill>
            </ShowcaseItem>
          ))}
        </ShowcaseGrid>
      </div>
    </ShowcaseSection>
  )
}
