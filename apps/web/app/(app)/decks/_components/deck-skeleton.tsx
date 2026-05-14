/**
 * Skeleton row matching the redesigned DeckCard anatomy: 2px corners, 1px
 * Soft Hairline border (left/right/bottom), 2px Inari Vermillion top stripe
 * at half opacity, leading 56px / 44px index column, content surface, and a
 * tiny mastery bar at the bottom. The shimmer mirrors the dashboard's warm
 * sweep so the Library reads "active fetch" rather than "static UI gone wrong."
 */
export function DeckCardSkeleton({ index = 0 }: { index?: number }): React.JSX.Element {
  return (
    <div
      className="animate-page-enter relative"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="relative overflow-hidden rounded-[2px] border-l border-r border-b border-soft-hairline bg-warm-paper-raised">
        {/* Top stripe at half opacity so the skeleton is identifiable but quieter. */}
        <span
          aria-hidden="true"
          className="absolute top-0 -left-px -right-px h-[2px] bg-inari-vermillion/55"
        />
        <div className="flex">
          {/* Leading index skeleton */}
          <div className="flex w-[2.75rem] shrink-0 items-center justify-center border-r border-soft-hairline bg-cream-inset/40 py-4 sm:w-14">
            <span className="dashboard-skeleton inline-block h-3.5 w-5 rounded-[1px]" />
          </div>

          {/* Content */}
          <div className="flex-1 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-center gap-2">
              <span className="dashboard-skeleton h-4 w-48 rounded-[1px]" />
              <span className="dashboard-skeleton h-4 w-16 rounded-[1px]" />
            </div>
            <div className="mt-2 flex gap-3">
              <span className="dashboard-skeleton h-3 w-16 rounded-[1px]" />
              <span className="dashboard-skeleton h-3 w-14 rounded-[1px]" />
              <span className="dashboard-skeleton h-3 w-16 rounded-[1px]" />
            </div>
            <div className="mt-3 h-[3px] w-full overflow-hidden bg-cream-inset">
              <div className="dashboard-skeleton h-full w-1/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
