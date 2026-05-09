'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface CardStackProps {
  /**
   * Stable identifier for the foreground content. Drives the foreground
   * AnimatePresence: when this value changes, the current card lifts and
   * fades, then the new card rises into place (page-turn metaphor).
   */
  contentKey: string
  /**
   * How many cards to render visibly behind the foreground card. Defaults
   * to 0 (single card, used for auth surfaces). Onboarding caps at 2 on
   * desktop, 1 on mobile. Behind cards fade in/out as the deck depletes.
   */
  cardsBehind?: number
  /**
   * Forward (default): outgoing card lifts up, incoming rises from below —
   * the top page being lifted off a stack. Backward: outgoing descends,
   * incoming arrives from above — paging back through the deck.
   */
  direction?:   'forward' | 'backward'
  className?:   string
  children:     React.ReactNode
}

export function CardStack({
  contentKey,
  cardsBehind = 0,
  direction   = 'forward',
  className   = '',
  children,
}: CardStackProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const behindLayers  = Array.from({ length: cardsBehind }, (_, i) => i + 1)

  // Forward: old leaves up (-y), new rises from below (+y). Backward: flipped.
  const exitY    = direction === 'backward' ?  28 : -28
  const initialY = direction === 'backward' ? -14 :  14

  // Calm page-turn cadence. Entrance settles deliberately (400ms); exit is
  // snappier (300ms, ~75% of entrance) so the leaving card commits before
  // the arriving card lands. ease-out-expo front-loads the travel and
  // spends the tail on settle — the perceived "calm" lives in that tail.
  // Inner stagger (StepCard's content cascade) is calibrated to begin ~100ms
  // into the entrance, so content arrives alongside the new card's fade-in.
  const enterTransition = reducedMotion === true
    ? { duration: 0 }
    : { duration: 0.40, ease: EASE_OUT_EXPO }

  const exitTransition = reducedMotion === true
    ? { duration: 0 }
    : { duration: 0.30, ease: EASE_OUT_EXPO }

  const behindTransition = reducedMotion === true
    ? { duration: 0 }
    : { duration: 0.40, ease: EASE_OUT_EXPO }

  return (
    <div className={['relative w-full', className].join(' ')}>
      {/* Behind layers: paper hints sitting under the foreground. They fade
          in/out as cardsBehind changes (steps 4 and 5 each lose a layer as
          the deck depletes). No movement, only opacity — they're scenery,
          not actors. initial={false} skips the entrance on first mount so
          deep links land with the deck already assembled, not building up. */}
      <AnimatePresence initial={false}>
        {behindLayers.map((depth) => {
          const xOffset       = depth * 6
          const yOffset       = depth * 8
          const targetOpacity = depth === 1 ? 0.22 : 0.10
          const responsive    = depth >= 2 ? 'hidden md:block' : 'block'

          return (
            <motion.div
              key={`behind-${depth}`}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: targetOpacity }}
              exit={{    opacity: 0 }}
              transition={behindTransition}
              className={['absolute inset-0 pointer-events-none', responsive].join(' ')}
              style={{
                transform: `translate(${xOffset}px, ${yOffset}px)`,
                zIndex:    -depth,
              }}
            >
              <div className="
                relative w-full h-full rounded-[2px] overflow-hidden
                bg-warm-paper-raised
                border-l border-r border-b border-soft-hairline
              " />
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Foreground card: page-turn between contentKeys. mode="wait" plays
          exit fully before mounting the new content, so the old card visibly
          clears before the new arrives — Iwanami page-turn cadence, not a
          crossfade. initial={false} skips the entrance on the very first
          render (no fade-in on mount; only on subsequent transitions), so the
          first paint is instant and the inside cascade carries the welcome. */}
      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: initialY }}
            animate={{ opacity: 1, y: 0,        transition: enterTransition }}
            exit={{    opacity: 0, y: exitY,    transition: exitTransition  }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
