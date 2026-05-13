'use client'

import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ForgettingCurve } from '@/components/srs/ForgettingCurve'
import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { fadeUpVariants, staggerVariants } from '@/lib/motion'

export default function OnboardingWelcomePage(): React.JSX.Element {
  const router        = useRouter()
  const reducedMotion = useReducedMotion()
  const initial       = reducedMotion === true ? 'shown' : 'hidden'

  return (
    <Card variant="default">
      <motion.div
        initial={initial}
        animate="shown"
        variants={staggerVariants}
        className="flex flex-col gap-7"
      >
        <motion.header variants={fadeUpVariants} className="flex flex-col gap-2">
          <p className="text-[0.625rem] font-mono uppercase tracking-[0.16em] text-faded-sumi">
            Tomo · Japanese spaced repetition
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-sumi-ink leading-[1.1] tracking-[-0.01em]">
            What are we working on?
          </h1>
        </motion.header>

        <motion.p variants={fadeUpVariants} className="text-base md:text-md font-medium text-sumi-ink leading-[1.55] max-w-[52ch]">
          A few questions, then your first cards.
        </motion.p>

        <motion.div variants={fadeUpVariants} className="bg-cool-paper-shade rounded-[2px] p-4 md:p-6 border border-soft-hairline">
          <ForgettingCurve className="w-full" />
          <p className="text-sm italic text-faded-sumi mt-3 leading-[1.55]">
            Without practice, recall fades. Tomo schedules review cards just before they slip, so daily reviews stay focused.
          </p>
        </motion.div>

        <motion.div variants={fadeUpVariants} className="flex justify-end">
          <Button
            size="lg"
            onClick={() => router.push('/onboarding/level')}
            trailingIcon={<ArrowGlyph direction="right" />}
          >
            Begin
          </Button>
        </motion.div>
      </motion.div>
    </Card>
  )
}
