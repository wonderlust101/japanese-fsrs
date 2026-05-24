'use client'

import { useOfflineQueueStatus } from '@/lib/api/reviews'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'

/**
 * Offline / queued-sync band. Visually anchored on the Tomo "card on a desk"
 * metaphor: buffered reviews are made physically present via small card-slip
 * glyphs on the right side of the band, so the abstract claim "your progress
 * is safe" becomes a countable deposit the user can see. The kanji seal at
 * the left changes per state (預 entrusted, 送 sent, 留 lingering, 済 done)
 * and breathes softly via a CSS keyframe to feel alive without being anxious.
 *
 * Tone reference: PRODUCT.md "patient practice partner... competent teacher
 * quietly helping the learner." No moralizing, no urgency, no "discard."
 */
type BandKind = 'held-empty' | 'held-queued' | 'syncing' | 'stuck' | 'idle'

interface BandContent {
  kanji:   string
  eyebrow: string
  body:    string
}

export function OfflineStatusBand(): React.JSX.Element | null {
  const online = useOnlineStatus()
  const queue  = useOfflineQueueStatus()

  const queuedSomething = queue.count > 0
  const showBand        = !online || queuedSomething
  if (!showBand) return null

  const kind: BandKind = resolveKind({ online, count: queue.count, stuck: queue.stuck })
  const content        = bandContent(kind, queue.count)

  return (
    <>
      <SealKeyframes />
      <section
        role="status"
        aria-live="polite"
        className={[
          'relative overflow-hidden rounded-[2px]',
          'border border-aizome-indigo/15 bg-warm-paper-raised',
          'px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2px] bg-aizome-indigo"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <KanjiSeal kanji={content.kanji} />

          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-aizome-indigo">
              {content.eyebrow}
            </p>
            <p className="mt-1.5 max-w-measure text-balance text-sm leading-relaxed text-sumi-ink/85">
              {content.body}
            </p>
          </div>

          {queue.count > 0 && <DeskHoldVisual count={queue.count} />}
        </div>

        {kind === 'stuck' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-aizome-indigo/15 pt-3.5">
            <button
              type="button"
              onClick={() => { queue.retryNow() }}
              className={[
                'inline-flex min-h-11 items-center rounded-[2px]',
                'border border-aizome-indigo/30 bg-warm-paper-raised px-3',
                'font-mono text-xs tracking-wide text-aizome-indigo',
                'today-motion-colors hover:bg-aizome-indigo/[0.06]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
              ].join(' ')}
            >
              Try sending again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.confirm(
                  `Let go of ${queue.count} pending review${queue.count === 1 ? '' : 's'}? They will not be sent up.`
                )) {
                  queue.discardPending()
                }
              }}
              className={[
                'inline-flex min-h-11 items-center rounded-[2px] px-2 py-1',
                'font-mono text-xs tracking-wide text-faded-sumi',
                'today-motion-colors hover:text-sumi-ink hover:underline underline-offset-4',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
              ].join(' ')}
            >
              Let them go
            </button>
          </div>
        )}
      </section>
    </>
  )
}

/** Circular seal-shaped kanji ornament. Breathes softly to feel alive. */
function KanjiSeal({ kanji }: { kanji: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      lang="ja"
      className={[
        'tomo-seal-breath',
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        'border border-aizome-indigo/25 bg-aizome-indigo/[0.06]',
        'font-display text-lg leading-none text-aizome-indigo',
      ].join(' ')}
    >
      <span className="translate-y-[0.04em]">{kanji}</span>
    </span>
  )
}

/**
 * Up to four small "deposit slip" rectangles, tilted slightly so the cluster
 * reads as a small pile rather than a row. Overflow above 4 shown as "+N"
 * in mono numerals next to the pile. Hidden below sm because the headline +
 * count already carries the meaning at narrow widths.
 */
function DeskHoldVisual({ count }: { count: number }): React.JSX.Element {
  const VISIBLE_MAX = 4
  const visible     = Math.min(count, VISIBLE_MAX)
  const slips       = Array.from({ length: visible }, (_, i) => i)
  // Pile widens by ~9px per slip + 22px for the last slip itself.
  const pileWidth   = (visible - 1) * 9 + 22

  return (
    <div
      aria-hidden="true"
      className="hidden shrink-0 items-end gap-2 sm:flex"
    >
      <div className="relative h-10" style={{ width: `${pileWidth}px` }}>
        {slips.map((i) => {
          const tilt   = (i - (visible - 1) / 2) * 1.8
          const lift   = -(visible - 1 - i) * 0.4
          return (
            <span
              key={i}
              className="absolute bottom-0 block h-9 w-[22px] rounded-[1px] border border-aizome-indigo/30 bg-cream-inset"
              style={{
                left:      `${i * 9}px`,
                transform: `translateY(${lift}px) rotate(${tilt}deg)`,
                zIndex:    i,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-1.5 top-1 block h-px bg-aizome-indigo/25"
              />
            </span>
          )
        })}
      </div>
      {count > VISIBLE_MAX && (
        <span className="font-mono text-xs tabular-nums text-aizome-indigo/70">
          +{count - VISIBLE_MAX}
        </span>
      )}
    </div>
  )
}

/**
 * Seal-breath keyframe + reduced-motion override. Inlined as a `<style>`
 * element so the component is self-contained — no globals.css edit needed.
 * React 19 hoists/dedupes style tags by content, so multiple band mounts
 * still emit one stylesheet.
 */
function SealKeyframes(): React.JSX.Element {
  return (
    <style>{`
      @keyframes tomo-seal-breath {
        0%, 100% { opacity: 0.92; }
        50%      { opacity: 0.64; }
      }
      .tomo-seal-breath {
        animation: tomo-seal-breath 3.6s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .tomo-seal-breath {
          animation: none;
          opacity: 0.92;
        }
      }
    `}</style>
  )
}

// ── State machine ────────────────────────────────────────────────────────────

function resolveKind({
  online,
  count,
  stuck,
}: {
  online: boolean
  count:  number
  stuck:  boolean
}): BandKind {
  if (stuck)              return 'stuck'
  if (!online && count > 0) return 'held-queued'
  if (!online)            return 'held-empty'
  if (count > 0)          return 'syncing'
  return 'idle'
}

function bandContent(kind: BandKind, count: number): BandContent {
  const reviewWord = count === 1 ? 'review' : 'reviews'
  const are        = count === 1 ? 'is'     : 'are'
  const them       = count === 1 ? 'it'     : 'them'
  const have       = count === 1 ? 'has'    : 'have'
  const willGoUp   = count === 1 ? "It'll go up" : "They'll go up"
  const human      = humanCount(count)

  switch (kind) {
    case 'held-empty':
      return {
        kanji:   '預',
        eyebrow: 'Held safely',
        body:    "You're offline. Anything you review next will rest on this desk until your connection returns.",
      }
    case 'held-queued':
      return {
        kanji:   '預',
        eyebrow: 'Held safely',
        body:    `${human} ${reviewWord} ${are} resting on your desk. ${willGoUp} when you reconnect.`,
      }
    case 'syncing':
      return {
        kanji:   '送',
        eyebrow: 'On the way up',
        body:    `${human} ${reviewWord} ${are} heading to your library now.`,
      }
    case 'stuck':
      return {
        kanji:   '留',
        eyebrow: 'Still on the desk',
        body:    `${human} ${reviewWord} ${have} been waiting a while. Try sending ${them} again, or let ${them} go.`,
      }
    case 'idle':
      return {
        kanji:   '済',
        eyebrow: 'In sync',
        body:    'Everything you have reviewed is safely on your library shelf.',
      }
  }
}

/**
 * Small whole numbers read better as words in body copy ("Three reviews"
 * vs. "3 reviews"); larger counts stay numeric so the surface doesn't get
 * unwieldy ("Twenty-seven reviews" reads worse than "27 reviews").
 */
function humanCount(n: number): string {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  return words[n] ?? String(n)
}
