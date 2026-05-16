import { QuietLink } from '@/components/ui/QuietLink'

interface InsightsSiblingBodyProps {
  /** Tab title for this view, e.g. "Mistakes". */
  title:       string
  /** Short teacher-voice framing line, 1–2 sentences. */
  description: string
  /** Tail note — what's coming in a future pass. Optional. */
  futureNote?: string
  children:    React.ReactNode
}

/**
 * Shared chrome for the four detail tabs (Mistakes, Progress, Forecast,
 * Statistics). Renders a quiet sub-title + framing prose, the topic-scoped
 * body, and a return link to Overview. The page-level header and tab nav
 * are owned by `insights/layout.tsx`.
 */
export function InsightsSiblingBody({
  title,
  description,
  futureNote,
  children,
}: InsightsSiblingBodyProps): React.JSX.Element {
  return (
    <div>
      <header className="mb-6 lg:mb-7">
        <h2 className="font-display text-2xl leading-[1.2] tracking-tight text-sumi-ink">
          {title}
        </h2>
        <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-faded-sumi">
          {description}
        </p>
      </header>
      <div className="space-y-6">{children}</div>
      <footer className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-soft-hairline pt-6">
        <QuietLink href="/insights" tone="sumi" size="sm">
          ← Back to overview
        </QuietLink>
        {futureNote !== undefined && (
          <span className="text-xs italic text-faded-sumi">{futureNote}</span>
        )}
      </footer>
    </div>
  )
}
