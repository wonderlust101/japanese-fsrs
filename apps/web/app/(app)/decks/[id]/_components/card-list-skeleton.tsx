/**
 * Skeleton mirroring the redesigned CardListItem anatomy: 2px vermillion top
 * stripe (half opacity to read as a loading state), leading state column,
 * two-line content area, JLPT pill ghost on row 2.
 */
export function CardListItemSkeleton(): React.JSX.Element {
  return (
    <li>
      <div className="relative overflow-hidden rounded-[2px] border-l border-r border-b border-soft-hairline bg-warm-paper-raised">
        <span
          aria-hidden="true"
          className="absolute top-0 -left-px -right-px h-[2px] bg-inari-vermillion/55"
        />
        <div className="flex">
          {/* Leading slot skeleton */}
          <div className="flex w-[2.75rem] shrink-0 flex-col items-center justify-center gap-1 border-r border-soft-hairline bg-cream-inset/40 py-3.5 sm:w-14 sm:py-4">
            <span className="dashboard-skeleton inline-block h-4 w-4 rounded-[1px]" />
            <span className="dashboard-skeleton inline-block h-2 w-6 rounded-[1px]" />
          </div>
          {/* Content */}
          <div className="flex-1 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-baseline gap-3">
              <span className="dashboard-skeleton h-5 w-28 rounded-[1px]" />
              <span className="dashboard-skeleton h-4 w-20 rounded-[1px]" />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="dashboard-skeleton h-4 w-48 rounded-[1px]" />
              <span className="dashboard-skeleton ml-auto h-5 w-10 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
