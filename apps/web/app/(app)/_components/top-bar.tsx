// Contextual page header. Each (app) page renders its own <TopBar> with
// page-specific content (title, actions, breadcrumbs). Not a global element.
export function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-6 h-14 bg-neutral-0/95 backdrop-blur-sm border-b border-neutral-200 shrink-0">
      {children}
    </header>
  )
}
