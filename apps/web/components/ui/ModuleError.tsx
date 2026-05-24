'use client'

interface ModuleErrorProps {
  /** What failed, lowercased noun phrase, e.g. "the maturity flow". */
  label:   string
  onRetry: () => void
}

/**
 * Compact inline failure state for a single module or section: "Couldn't load
 * {label}. [Retry]". Distinct from the genuine "no data yet" empty state — this
 * means the fetch failed and the learner can retry just this slot without
 * reloading the page. For a whole-surface connection failure, use the
 * page-level {@link QueueErrorPane} instead.
 */
export function ModuleError({ label, onRetry }: ModuleErrorProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[2px] bg-cream-inset px-4 py-3.5">
      <p className="text-base text-sumi-ink">
        Couldn&rsquo;t load {label}.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="font-mono text-sm text-inari-vermillion-deep underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        Retry
      </button>
    </div>
  )
}
