interface SideNavProps {
  sections: ReadonlyArray<{ id: string; label: string }>
}

export function SideNav({ sections }: SideNavProps): React.JSX.Element {
  return (
    <nav
      aria-label="Component categories"
      className="hidden lg:block self-start sticky top-10"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3 px-2">Categories</p>
      <ul className="flex flex-col">
        {sections.map(section => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={[
                'block px-2 py-1.5 text-sm text-faded-sumi rounded-[2px]',
                'hover:text-sumi-ink hover:bg-cream-inset',
              ].join(' ')}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
