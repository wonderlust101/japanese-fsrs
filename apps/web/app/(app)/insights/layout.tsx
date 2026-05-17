/**
 * Pass-through layout for `/insights/*`. Each child page owns its own
 * `TopBar` (so the sticky chrome can render full-width outside the page
 * container) and its own `max-w-[1440px]` content container. This keeps
 * the sticky TopBar honest while preserving the shared route grouping.
 */
export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return <>{children}</>
}
