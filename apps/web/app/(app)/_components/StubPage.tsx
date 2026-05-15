import Link from 'next/link'

export interface StubLink {
  href:  string
  label: string
}

export interface StubPageProps {
  title: string
  links: StubLink[]
}

export function StubPage({ title, links }: StubPageProps): React.JSX.Element {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-sumi-ink">{title}</h1>
      <p className="text-sm text-sumi-ink/70">This page is not implemented yet.</p>
      {links.length > 0 && (
        <nav aria-label={`Links out of ${title}`}>
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-inari-vermillion underline-offset-2 hover:underline"
                >
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  )
}
