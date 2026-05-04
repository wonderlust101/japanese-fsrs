export function CardSkeleton(): React.JSX.Element {
  return (
    <div className="bg-neutral-0 rounded-[var(--radius-lg)] border border-neutral-200 p-6 space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-16 bg-neutral-200 rounded" />
        <div className="h-8 w-40 bg-neutral-200 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 bg-neutral-200 rounded" />
        <div className="h-4 w-32 bg-neutral-200 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 bg-neutral-200 rounded" />
        <div className="h-4 w-full bg-neutral-200 rounded" />
      </div>
      <div className="border-t border-neutral-100 pt-4 space-y-2">
        <div className="h-3 w-32 bg-neutral-200 rounded" />
        <div className="h-4 w-full bg-neutral-200 rounded" />
        <div className="h-4 w-3/4 bg-neutral-200 rounded" />
      </div>
      <div className="border-t border-neutral-100 pt-4">
        <div className="h-4 w-full bg-neutral-200 rounded" />
      </div>
    </div>
  )
}
