export function CardListItemSkeleton(): React.JSX.Element {
  return (
    <li className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] border border-soft-hairline px-5 py-4 space-y-2 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-7 w-28 bg-cream-inset rounded" />
        <div className="h-4 w-20 bg-cream-inset rounded" />
        <div className="ml-auto h-3 w-3 rounded-full bg-cream-inset" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-48 bg-cream-inset rounded" />
        <div className="ml-auto h-5 w-10 bg-cream-inset rounded-full" />
      </div>
    </li>
  )
}
