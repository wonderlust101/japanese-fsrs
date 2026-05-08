export function DeckCardSkeleton(): React.JSX.Element {
  return (
    <div className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-48 bg-cream-inset rounded" />
        <div className="h-5 w-20 bg-cream-inset rounded" />
      </div>
      <div className="h-3 w-full bg-cream-inset rounded" />
      <div className="flex gap-4">
        <div className="h-3 w-20 bg-cream-inset rounded" />
        <div className="h-3 w-16 bg-cream-inset rounded" />
      </div>
      <div className="h-1 w-full bg-cream-inset rounded-full" />
    </div>
  )
}
