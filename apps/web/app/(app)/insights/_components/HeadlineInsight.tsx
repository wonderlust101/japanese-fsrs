import { cn } from '@/lib/utils'

import { splitEmphasis, type InsightTone } from './headline-insight'

interface HeadlineInsightProps {
  text:        string
  tone:        InsightTone
  isLoading?:  boolean
}

const TONE_ACCENT: Record<InsightTone, string> = {
  celebratory: 'text-inari-vermillion-deep',
  attention:   'text-jlpt-beyond-amber-warn',
  neutral:     'text-inari-vermillion-deep',
  'new-user':  'text-sumi-ink',
}

export function HeadlineInsight({
  text,
  tone,
  isLoading = false,
}: HeadlineInsightProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="mb-2 pt-2">
        <div className="dashboard-skeleton h-7 w-4/5 rounded-[2px]" />
        <div className="dashboard-skeleton mt-3 h-7 w-3/5 rounded-[2px]" />
      </div>
    )
  }

  const parts = splitEmphasis(text)

  return (
    <p
      className="font-display text-2xl leading-[1.25] tracking-tight text-sumi-ink sm:text-3xl sm:leading-[1.2]"
      data-insight-tone={tone}
    >
      {parts.map((part, i) =>
        part.kind === 'em' ? (
          <em key={i} className={cn('not-italic font-semibold', TONE_ACCENT[tone])}>
            {part.text}
          </em>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  )
}
