'use client'

import { Button } from '@/components/ui/Button'
import { IconKeyboard, IconSignOut } from '@/components/icons/chrome-marks'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { cn } from '@/lib/utils'

interface SessionTopBarProps {
  percentage:    number
  /** 1-indexed position of the currently-shown card (e.g. card 5 of 12).
   *  Together with `totalCount`, drives the small "5/12" counter at md+. */
  positionIndex?: number
  totalCount?:    number
  offline:       boolean
  syncError:     boolean
  onEndSession:  () => void
  /** Mobile-only escalation: ask the page to open a confirm dialog before
   *  ending the session. Falls back to `onEndSession` direct when unset
   *  (drill session uses the same component without the confirm layer). */
  onEndSessionRequest?: () => void
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
  positionIndex,
  totalCount,
  offline,
  syncError,
  onEndSession,
  onEndSessionRequest,
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
        <div className="flex items-center gap-2 min-w-0">
          <TopBarTitle kanji={eyebrowKanji} label={eyebrowLabel} keepOnMobile />
          {(offline || syncError) && (
            <span
              role="status"
              className={cn(
                'ml-2 inline-flex items-center gap-2 rounded-full px-2 py-0.5',
                'font-mono text-sm border',
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

        <div className="flex items-center gap-2">
          {positionIndex !== undefined && totalCount !== undefined && totalCount > 0 && (
            <span
              aria-label={`Card ${positionIndex} of ${totalCount}`}
              className="max-md:hidden inline-flex min-w-[3rem] justify-end font-mono text-xs tabular-nums text-faded-sumi"
            >
              {positionIndex}<span aria-hidden="true" className="text-faded-sumi/60 mx-px">/</span>{totalCount}
            </span>
          )}
          {onOpenTeach !== undefined && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenTeach}
              title="Keyboard shortcuts"
              leadingIcon={<IconKeyboard className="w-5 h-5" />}
              className="max-md:hidden"
            >
              Shortcuts
            </Button>
          )}
          <Button
            type="button"
            variant="editorial"
            size="sm"
            iconOnly
            onClick={onEndSessionRequest ?? onEndSession}
            aria-label={endLabel}
            title={endLabel}
            leadingIcon={<IconSignOut className="w-5 h-5" />}
            className="md:hidden min-h-11 min-w-11"
          />
          <Button
            type="button"
            variant="editorial"
            size="sm"
            onClick={onEndSession}
            leadingIcon={<IconSignOut className="w-5 h-5" />}
            className="max-md:hidden"
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

