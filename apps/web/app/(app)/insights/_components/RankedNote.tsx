import { cn } from '@/lib/utils'

import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'

import { splitEmphasis, type NoteTone } from './weekly-report'

export type NoteWeight = 'lead' | 'medium' | 'compact'

interface RankedNoteProps {
  weight:   NoteWeight
  tone:     NoteTone
  kanji:    string
  label:    string
  body:     string
  deepLink: { label: string; href: string }
  /** Optional inline sketch (lives below the body inside the same card). */
  children?: React.ReactNode
}

/**
 * One beat of the weekly report, rendered as a `SectionCard` (the brand's
 * canonical 2px-top-stripe + soft-hairline card surface). Three weights
 * vary interior content density:
 *
 *  - `lead`    : larger body type; on lg+ the prose and sketch split into a
 *                two-column interior so the card uses 1440px without
 *                creating unreadable line lengths.
 *  - `medium`  : standard body type, stacked interior. Sized for the
 *                2-col notes grid where each card is roughly half the page.
 *  - `compact` : smaller body type, compact header variant.
 *
 * The weight is set by severity rank, not by note kind. Progress can be
 * lead one week and compact the next. All weights render their assigned
 * sketch when one is available; the sketch is part of the card body, not
 * a standalone element.
 */
export function RankedNote({
  weight,
  tone,
  kanji,
  label,
  body,
  deepLink,
  children,
}: RankedNoteProps): React.JSX.Element {
  const isLead    = weight === 'lead'
  const isCompact = weight === 'compact'
  const hasSketch = children !== undefined && children !== null

  const bodyTypeClass = isLead
    ? 'text-[1.125rem] leading-relaxed sm:text-[1.1875rem] lg:text-[1.25rem]'
    : isCompact
      ? 'text-[0.9375rem] leading-relaxed'
      : 'text-[1rem] leading-relaxed'

  return (
    <SectionCard
      kanji={kanji}
      label={label}
      variant={isCompact ? 'compact' : 'default'}
      rightContent={
        <QuietLink
          href={deepLink.href}
          tone={isLead ? 'brand' : 'sumi'}
          trailingArrow
          size="sm"
        >
          {deepLink.label}
        </QuietLink>
      }
    >
      {isLead && hasSketch ? (
        <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-x-12 xl:gap-x-16">
          <p className={cn('max-w-[58ch] text-sumi-ink/90', bodyTypeClass)}>
            {renderEmphasis(body, tone)}
          </p>
          <div className="min-w-0 pb-1 lg:py-2 xl:py-3">
            {children}
          </div>
        </div>
      ) : (
        <>
          <p className={cn('max-w-[62ch] text-sumi-ink/90', bodyTypeClass)}>
            {renderEmphasis(body, tone)}
          </p>
          {hasSketch && (
            <div className={cn('mt-7 pb-1', isCompact && 'mt-6')}>
              {children}
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}

function renderEmphasis(text: string, tone: NoteTone): React.ReactNode {
  const parts = splitEmphasis(text)
  const emphasisClass =
    tone === 'attention'
      ? 'font-semibold text-inari-vermillion-deep'
      : tone === 'celebratory'
        ? 'font-semibold text-inari-vermillion'
        : 'font-semibold text-sumi-ink'
  return parts.map((p, i) =>
    p.kind === 'em' ? (
      <em key={i} className={cn('not-italic', emphasisClass)}>
        {p.text}
      </em>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )
}
