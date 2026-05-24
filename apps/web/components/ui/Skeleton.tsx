/* Retired primitive. All per-component loading placeholders were removed
   when the page-level <PageLoader/> (TomoLoader.tsx) became the only
   loading surface in the app. This component now renders nothing so any
   `<Skeleton .../>` still left in the codebase is a no-op.

   New code must not reference this. Schedule the remaining JSX call
   sites for incremental cleanup; they are harmless but dead. */

export function Skeleton(_props: {
  className?: string
  width?:     string | number
  height?:    string | number
}): null {
  return null
}
