'use client'

import { Card } from '@/components/ui/Card'

/**
 * StepChild is the onboarding-era wrapper used by the five step pages
 * (decks, goal, interests, level, schedule) for per-row layout. It used to
 * orchestrate the staggered fade-up cascade via the `motion` library; with
 * motion removed, it renders a plain `<div>` so call sites don't need to
 * change.
 */
export function StepChild({
  children,
  className = '',
}: {
  children:   React.ReactNode
  className?: string
}): React.JSX.Element {
  return <div className={className}>{children}</div>
}

interface StepCardProps {
  /** Left pane: the SRS preview visualization. */
  previewPane: React.ReactNode
  heading:     string
  subhead:     string
  /** Right pane content: answer affordance (selection cards, chips, deck rows). */
  children:    React.ReactNode
  /** Footer row content: Back + Continue buttons. */
  footer:      React.ReactNode
}

/**
 * The shared composition for the five questionnaire steps.
 *
 * Choreography: the entire grid (preview pane + right column) is wrapped in a
 * single staggering motion container. delayChildren on that outer container is
 * tuned to wait for CardStack's foreground fade-in, so the card mounts
 * visibly empty before any content appears. Then content cascades:
 *
 *   1. Aside (preview pane) fades in
 *   2. Right column begins, header first
 *   3. Body items stagger in tightly
 *   4. Footer arrives near the end
 *
 * On `< md`, the columns stack with the aside above the question column;
 * the stagger order is preserved.
 */
export function StepCard({
  previewPane,
  heading,
  subhead,
  children,
  footer,
}: StepCardProps): React.JSX.Element {
  return (
    <Card variant="default">
      <div        className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-8 md:gap-12"
      >
        {/* SRS preview pane (left on md, top on mobile) */}
        <aside          className="flex flex-col items-stretch gap-3"
        >
          <p className="text-xs font-mono uppercase tracking-[0.1em] text-faded-sumi">
            preview
          </p>
          <div className="flex-1">{previewPane}</div>
        </aside>

        {/* Right column with its own inner stagger */}
        <section          className="flex flex-col gap-8"
        >
          <header className="flex flex-col gap-2">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-sumi-ink leading-[1.1]">
              {heading}
            </h1>
            <p className="text-base text-faded-sumi leading-relaxed max-w-[52ch]">
              {subhead}
            </p>
          </header>

          {/* Inner stagger so body items (selection cards, chips, deck rows)
              arrive one by one instead of together. */}
          <div>{children}</div>

          <div className="mt-auto pt-2">
            {footer}
          </div>
        </section>
      </div>
    </Card>
  )
}
