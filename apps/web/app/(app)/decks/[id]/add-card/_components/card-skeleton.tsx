export function CardSkeleton(): React.JSX.Element {
  return (
    <div className="bg-warm-paper-raised rounded-[var(--radius-lg)] border border-soft-hairline p-6 space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-16 bg-cream-inset rounded" />
        <div className="h-8 w-40 bg-cream-inset rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 bg-cream-inset rounded" />
        <div className="h-4 w-32 bg-cream-inset rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 bg-cream-inset rounded" />
        <div className="h-4 w-full bg-cream-inset rounded" />
      </div>
      <div className="border-t border-soft-hairline pt-4 space-y-2">
        <div className="h-3 w-32 bg-cream-inset rounded" />
        <div className="h-4 w-full bg-cream-inset rounded" />
        <div className="h-4 w-3/4 bg-cream-inset rounded" />
      </div>
      <div className="border-t border-soft-hairline pt-4">
        <div className="h-4 w-full bg-cream-inset rounded" />
      </div>
    </div>
  )
}
