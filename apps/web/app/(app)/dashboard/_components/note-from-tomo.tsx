import { Logo } from '@/components/ui/Logo'

import { ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

export interface TomoInsight {
  date: string
  body: React.ReactNode
}

export interface DailyIdiom {
  date:    string
  word:    string
  reading: string
  meaning: string
}

interface NoteFromTomoProps {
  state:    ModuleState
  insight?: TomoInsight | null
  idiom?:   DailyIdiom
}

/**
 * Note from Tomo — letterhead variant.
 *
 * Renders as Tomo's stationery: a faint kitsune watermark cropped against the
 * top-right corner, a 'NOTE FROM TOMO' small-caps mono header with the date
 * on the right, the body indented from the card's left edge as if it were
 * letter content, and a vermillion 朋 sign-off (kanji for "tomo" / a
 * peer-companion) in the bottom-right as a signature glyph.
 *
 * The card uses the same warm-paper-raised + vermillion top stripe chrome as
 * the dashboard hero — both are "voice modules" speaking to the user; data
 * modules elsewhere on the page stay bare.
 */
export function NoteFromTomo({
  state,
  insight,
  idiom,
}: NoteFromTomoProps): React.JSX.Element {
  const date = state === 'loading'
    ? null
    : (insight?.date ?? idiom?.date ?? '')

  return (
    <article
      className={[
        'relative h-full bg-warm-paper-raised',
        'border-l border-r border-b border-soft-hairline',
        'border-t-2 border-t-inari-vermillion',
        'rounded-[2px] overflow-hidden',
      ].join(' ')}
    >
      {/* Watermark — kitsune at low opacity, cropped against top-right corner */}
      <div
        aria-hidden="true"
        className="absolute -top-3 -right-5 sm:-top-4 sm:-right-7 pointer-events-none opacity-[0.05] select-none"
      >
        <Logo size={170} showWordmark={false} />
      </div>

      <div className="relative px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <LetterheadHeader date={date} />

        <div className="mt-7 pl-3 sm:pl-5 lg:pl-6">
          {state === 'loading' && <LoadingBody />}
          {state === 'error'   && <ModuleError message="Couldn't reach Tomo's note." />}
          {state === 'default' && insight !== null && insight !== undefined && <InsightBody insight={insight} />}
          {state === 'default' && (insight === null || insight === undefined) && idiom !== undefined && <IdiomBody idiom={idiom} />}
          {state === 'default' && (insight === null || insight === undefined) && idiom === undefined && (
            <p className="text-sm text-faded-sumi italic max-w-md leading-relaxed">
              A note from Tomo will appear here.
            </p>
          )}
        </div>

        {/* Sign-off only renders when a real body is present (insight or idiom).
            Suppressed in loading / error / empty so we don't sign off on
            nothing. */}
        {state === 'default' && ((insight !== null && insight !== undefined) || idiom !== undefined) && (
          <div className="mt-7 pr-1 flex justify-end">
            <span
              lang="ja"
              aria-hidden="true"
              className="font-display text-[1.625rem] leading-none text-inari-vermillion select-none"
            >
              朋
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

// ── Letterhead header (small-caps mono label + date) ─────────────────────────

function LetterheadHeader({ date }: { date: string | null }): React.JSX.Element {
  return (
    <header className="flex items-baseline justify-between gap-4">
      <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-sumi-ink">
        Note from Tomo
      </h2>
      {date !== null && date !== '' && (
        <p className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
          {date}
        </p>
      )}
      {date === null && <SkeletonBlock width={64} height={10} />}
    </header>
  )
}

// ── Insight body (paid tier) ─────────────────────────────────────────────────

function InsightBody({ insight }: { insight: TomoInsight }): React.JSX.Element {
  return (
    <p className="text-base text-sumi-ink leading-[1.65] max-w-[52ch]">
      {insight.body}
    </p>
  )
}

// ── Idiom body (fallback for free tier or no-insight days) ───────────────────

function IdiomBody({ idiom }: { idiom: DailyIdiom }): React.JSX.Element {
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        today&apos;s phrase
      </p>
      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <span lang="ja" className="font-display text-3xl text-sumi-ink tracking-[-0.01em]">
          {idiom.word}
        </span>
        <span className="font-mono text-sm text-faded-sumi tracking-wide">
          {idiom.reading}
        </span>
      </div>
      <p className="mt-3 text-sm text-faded-sumi leading-relaxed max-w-[44ch]">
        {idiom.meaning}
      </p>
    </div>
  )
}

// ── Loading body ─────────────────────────────────────────────────────────────

function LoadingBody(): React.JSX.Element {
  return (
    <div className="space-y-2.5">
      <SkeletonBlock width="92%" height={16} />
      <SkeletonBlock width="84%" height={16} />
      <SkeletonBlock width="58%" height={16} />
    </div>
  )
}
