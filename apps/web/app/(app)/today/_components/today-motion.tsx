'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { EASE_OUT_EXPO } from '@/lib/motion'

const MODULE_REVEAL_DURATION = 0.30
const STATE_ENTER_DURATION = 0.24
const STATE_EXIT_DURATION = 0.16
const ROW_REVEAL_DURATION = 0.22
const ROW_STAGGER = 0.025
const MAX_ROW_DELAY = 0.12

export function DashboardModuleReveal({
  children,
  className = '',
  delay = 0,
}: {
  children:   React.ReactNode
  className?: string
  delay?:     number
}): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reducedMotion === true ? false : { opacity: 0, y: 10 }}
      animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion === true ? 0 : MODULE_REVEAL_DURATION,
        ease:     EASE_OUT_EXPO,
        delay:    reducedMotion === true ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  )
}

export function DashboardStatePresence({
  children,
  className = '',
  stateKey,
}: {
  children:   React.ReactNode
  className?: string
  stateKey:   string
}): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stateKey}
        className={className}
        initial={reducedMotion === true ? false : { opacity: 0, y: 8 }}
        animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={
          reducedMotion === true
            ? { opacity: 0, transition: { duration: 0 } }
            : { opacity: 0, y: -5, transition: { duration: STATE_EXIT_DURATION, ease: EASE_OUT_EXPO } }
        }
        transition={{
          duration: reducedMotion === true ? 0 : STATE_ENTER_DURATION,
          ease:     EASE_OUT_EXPO,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function DashboardRowMotion({
  children,
  className = '',
  index = 0,
  interactive = true,
}: {
  children:     React.ReactNode
  className?:   string
  index?:       number
  interactive?: boolean
}): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const shouldMove = reducedMotion !== true && interactive
  const interactionProps = shouldMove
    ? {
        whileHover: {
          x:          3,
          transition: { duration: 0.18, ease: EASE_OUT_EXPO },
        },
        whileTap: {
          scale:      0.996,
          transition: { duration: 0.10, ease: EASE_OUT_EXPO },
        },
      }
    : {}

  return (
    <motion.li
      {...interactionProps}
      className={className}
      initial={reducedMotion === true ? false : { opacity: 0, y: 6 }}
      animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion === true ? 0 : ROW_REVEAL_DURATION,
        ease:     EASE_OUT_EXPO,
        delay:    reducedMotion === true ? 0 : Math.min(index * ROW_STAGGER, MAX_ROW_DELAY),
      }}
    >
      {children}
    </motion.li>
  )
}

export { EASE_OUT_EXPO as DASHBOARD_EASE }
