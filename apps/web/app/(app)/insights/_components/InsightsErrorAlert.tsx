import { ModuleError } from '@/components/ui/ModuleError'

interface InsightsErrorAlertProps {
  /** What failed, as a lowercased noun phrase, e.g. "your forecast". */
  label:   string
  onRetry: () => void
}

/**
 * Page-level failure state shared by the Insights pages. Centers the compact
 * <ModuleError> (which owns the "Couldn't load … / Retry" affordance) in a
 * width-capped `role="alert"` block so a fetch failure offers a real recovery
 * action instead of the old dead-end "refresh the page" copy.
 */
export function InsightsErrorAlert({
  label,
  onRetry,
}: InsightsErrorAlertProps): React.JSX.Element {
  return (
    <div role="alert" className="mx-auto mt-6 w-full max-w-[760px]">
      <ModuleError label={label} onRetry={onRetry} />
    </div>
  )
}
