/**
 * Skeleton row matching the redesigned DeckCard anatomy: 2px vermillion top
 * stripe, leading slot column, identity + chip-stack + action cluster on one
 * horizontal row, then a 6px full-bleed progress bar at the card's bottom
 * edge. The shimmer mirrors the dashboard's warm sweep so the page reads
 * "active fetch" rather than "static UI gone wrong."
 */
export function DeckCardSkeleton({ index = 0 }: { index?: number }): React.JSX.Element {
  return (
    <div
      className="animate-page-enter relative"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="relative overflow-hidden rounded-[2px] border-l border-r border-b border-soft-hairline bg-warm-paper-raised">
        <span
          aria-hidden="true"
          className="absolute top-0 -left-px -right-px h-[2px] bg-inari-vermillion/55"
        />
        <div className="flex">
          {/* Leading slot skeleton */}
          <div className="flex w-[2.75rem] shrink-0 items-center justify-center border-r border-soft-hairline bg-cream-inset/40 py-5 sm:w-14 sm:py-6">
            <span className="dashboard-skeleton inline-block h-3.5 w-5 rounded-[1px]" />
          </div>

          {/* Content row — grid mirrors deck-card so the loading shape
              doesn't jump on data arrival. */}
          <div className="grid flex-1 items-center grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5 px-5 py-5 sm:gap-x-6 sm:px-6 sm:py-6 md:gap-x-8 lg:gap-x-10">
            <span className="dashboard-skeleton col-start-1 row-start-1 block h-5 w-48 rounded-[1px]" />
            <span className="dashboard-skeleton col-start-1 row-start-2 block h-3 w-24 rounded-[1px]" />
            <span className="dashboard-skeleton col-start-2 row-start-1 hidden h-5 w-14 justify-self-end rounded-[1px] sm:block" />
            <span className="dashboard-skeleton col-start-2 row-start-2 hidden h-3 w-24 justify-self-end rounded-[1px] sm:block" />
            <div className="col-start-3 row-span-2 flex items-center gap-2 sm:gap-3">
              <span className="dashboard-skeleton h-8 w-16 rounded-[2px]" />
              <span className="dashboard-skeleton h-7 w-7 rounded-[2px]" />
            </div>
          </div>
        </div>

        {/* Bottom progress unit: caption strip + 12px bar on soft-hairline. */}
        <div className="border-t border-soft-hairline">
          <div className="flex items-baseline justify-between gap-2 px-4 pt-2 pb-1.5 sm:px-6">
            <span className="dashboard-skeleton h-2.5 w-14 rounded-[1px]" />
            <span className="dashboard-skeleton h-2.5 w-24 rounded-[1px]" />
          </div>
          <div className="h-3 w-full overflow-hidden bg-soft-hairline/70">
            <div className="dashboard-skeleton h-full w-1/3" />
          </div>
        </div>
      </div>
    </div>
  )
}
