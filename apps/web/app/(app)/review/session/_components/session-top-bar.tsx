'use client'

import { Button } from '@/components/ui/Button'
import { IconHelp } from '@/components/icons/chrome-marks'
import { cn } from '@/lib/utils'

interface SessionTopBarProps {
  percentage:    number
  offline:       boolean
  syncError:     boolean
  onEndSession:  () => void
  onOpenTeach?:  () => void
  /** Eyebrow label to the right of the kanji. Defaults to `Reviewing`. */
  eyebrowLabel?: string
  /** Kanji ornament. Defaults to `復` (review). */
  eyebrowKanji?: string
  /** End-session button copy. Defaults to `End session`. */
  endLabel?:     string
}

// Page-scope chrome for the review session. Fixed to the top of the layout
// and intentionally bare: identity on the left, session end on the right,
// hairline progress tucked beneath. Position-in-queue lives in the hairline
// alone; learner prefs live in the in-card overflow menu so the chrome
// stays meditative.
//
// Also consumed by the weak-spot drill session (different `eyebrowLabel` +
// `endLabel`, same kanji, same vermillion accent). The drill is a 1-to-1
// visual copy of the review session; this component is the source of truth.

export function SessionTopBar({
  percentage,
  offline,
  syncError,
  onEndSession,
  onOpenTeach,
  eyebrowLabel = 'Reviewing',
  eyebrowKanji = '復',
  endLabel = 'End session',
}: SessionTopBarProps): React.JSX.Element {
  return (
    <header
      role="banner"
      aria-label="Review session controls"
      className="fixed top-0 left-0 right-0 z-40 bg-warm-paper-raised border-b border-soft-hairline/55"
    >
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span
            lang="ja"
            aria-hidden="true"
            className="font-japanese text-xl text-inari-vermillion leading-none translate-y-[0.05em]"
          >
            {eyebrowKanji}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-sumi-ink/80">
            {eyebrowLabel}
          </span>
          {(offline || syncError) && (
            <span
              role="status"
              className={cn(
                'ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
                'font-mono text-[0.625rem] uppercase tracking-[0.14em] border',
                offline
                  ? 'border-soft-hairline bg-cream-inset/60 text-faded-sumi'
                  : 'border-jlpt-beyond-amber-warn/35 bg-jlpt-beyond-bg/60 text-jlpt-beyond-amber-warn',
              )}
            >
              {offline ? (
                <>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-faded-sumi/70" />
                  Offline
                </>
              ) : (
                'Saved locally'
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenTeach !== undefined && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onOpenTeach}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              leadingIcon={<IconHelp className="w-4 h-4" />}
            />
          )}
          <Button
            type="button"
            variant="editorial"
            size="sm"
            onClick={onEndSession}
          >
            {endLabel}
          </Button>
        </div>
      </div>

      {/* Hairline progress strip tucked beneath the bar */}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Session progress"
        className="h-px w-full bg-soft-hairline/45"
      >
        <div
          style={{ width: `${percentage}%` }}
          className="h-full bg-inari-vermillion/85 transition-[width] duration-[280ms] ease-out"
        />
      </div>
    </header>
  )
}

