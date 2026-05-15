import { SectionCard } from '@/components/ui/SectionCard'

import {
  ConnectionErrorNotice,
  EmptyState,
  type ModuleState,
  SkeletonBlock,
  UnavailableState,
} from './section-primitives'

export interface PracticeInsight {
  date: string
  body: React.ReactNode
}

export interface DailyIdiom {
  date:    string
  word:    string
  reading: string
  meaning: string
}

interface PracticeSignalProps {
  state:    ModuleState
  insight?: PracticeInsight | null
  idiom?:   DailyIdiom
}

const PRACTICE_SIGNAL_EXTRA_CLASS = 'flex flex-col'
const PRACTICE_FOCUS_LABEL = 'Practice focus'
const PRACTICE_FOCUS_DESCRIPTION = 'One word, reading, or grammar pattern that deserves extra care today.'

export function PracticeSignal({
  state,
  insight,
  idiom,
}: PracticeSignalProps): React.JSX.Element {
  const date = state === 'default'
    ? (insight?.date ?? idiom?.date)
    : undefined

  if (state === 'loading') {
    return (
      <SectionCard
        id="practice-signal"
        kanji="要"
        label={PRACTICE_FOCUS_LABEL}
        variant="compact"
        description={PRACTICE_FOCUS_DESCRIPTION}
        rightContent={<SkeletonBlock width={64} height={10} />}
        ariaBusy
        className={PRACTICE_SIGNAL_EXTRA_CLASS}
      >
        <div className="flex min-h-[14rem] items-center">
          <LoadingBody />
        </div>
      </SectionCard>
    )
  }

  if (state === 'error') {
    return (
      <SectionCard
        id="practice-signal"
        kanji="要"
        label={PRACTICE_FOCUS_LABEL}
        variant="compact"
        description={PRACTICE_FOCUS_DESCRIPTION}
        className={PRACTICE_SIGNAL_EXTRA_CLASS}
      >
        <div className="flex min-h-[14rem] items-center py-5">
          <ConnectionErrorNotice sectionName="Practice focus" />
        </div>
      </SectionCard>
    )
  }

  if (state === 'unavailable') {
    return (
      <SectionCard
        id="practice-signal"
        kanji="要"
        label={PRACTICE_FOCUS_LABEL}
        variant="compact"
        description={PRACTICE_FOCUS_DESCRIPTION}
        className={PRACTICE_SIGNAL_EXTRA_CLASS}
      >
        <UnavailableState
          title="Practice focus needs review data"
          body="Start from the review queue for now. Once connected, this card names the one pattern most worth a lighter second pass today."
          action={{ href: '/review/setup', label: 'Start reviews' }}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      id="practice-signal"
      kanji="要"
      label={PRACTICE_FOCUS_LABEL}
      variant="compact"
      description={PRACTICE_FOCUS_DESCRIPTION}
      {...(date !== undefined && { rightContent: <span>{date}</span> })}
      className={PRACTICE_SIGNAL_EXTRA_CLASS}
    >
      <div className="flex min-h-[14rem] flex-1 flex-col justify-center">
        {insight !== null && insight !== undefined && <InsightBody insight={insight} />}
        {(insight === null || insight === undefined) && idiom !== undefined && <IdiomBody idiom={idiom} />}
        {(insight === null || insight === undefined) && idiom === undefined && (
          <EmptyState
            title="Review a few cards to choose today's focus"
            body="After a few answers, this card points to the word, reading, or grammar pattern that would benefit from a little extra care."
            action={{ href: '/review/setup', label: 'Start reviews' }}
            visual="focus"
          />
        )}
      </div>
    </SectionCard>
  )
}

function InsightBody({ insight }: { insight: PracticeInsight }): React.JSX.Element {
  return (
    <p className="max-w-[52ch] break-words text-base leading-[1.65] text-sumi-ink">
      {insight.body}
    </p>
  )
}

function IdiomBody({ idiom }: { idiom: DailyIdiom }): React.JSX.Element {
  const word = idiom.word.trim() || '今日'
  const reading = idiom.reading.trim()
  const meaning = idiom.meaning.trim() || 'Review this phrase during practice.'

  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        today&apos;s phrase
      </p>
      <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-3">
        <span lang="ja" className="min-w-0 break-words font-display text-3xl text-sumi-ink">
          {word}
        </span>
        {reading.length > 0 && (
          <span lang="ja" className="min-w-0 break-words font-mono text-sm tracking-wide text-faded-sumi">
            {reading}
          </span>
        )}
      </div>
      <p className="mt-3 max-w-[44ch] break-words text-sm leading-relaxed text-faded-sumi">
        {meaning}
      </p>
    </div>
  )
}

function LoadingBody(): React.JSX.Element {
  return (
    <div className="w-full space-y-2.5">
      <SkeletonBlock width="92%" height={16} />
      <SkeletonBlock width="84%" height={16} />
      <SkeletonBlock width="58%" height={16} />
    </div>
  )
}
