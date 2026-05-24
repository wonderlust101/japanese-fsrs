interface ShowcaseSectionProps {
  id:           string
  title:        string
  description?: string
  children:     React.ReactNode
}

export function ShowcaseSection({
  id,
  title,
  description,
  children,
}: ShowcaseSectionProps): React.JSX.Element {
  return (
    <section
      id={id}
      // scroll-mt offsets the sticky/anchor so the heading isn't jammed
      // under the page header when the side-nav anchor jumps to it.
      className="scroll-mt-10"
      aria-labelledby={`${id}-heading`}
    >
      <header className="mb-6 border-b border-soft-hairline pb-3">
        <h2
          id={`${id}-heading`}
          className="font-display text-xl text-sumi-ink"
        >
          {title}
        </h2>
        {description !== undefined && (
          <p className="mt-1 text-sm text-faded-sumi max-w-measure">{description}</p>
        )}
      </header>
      <div className="flex flex-col gap-y-6">{children}</div>
    </section>
  )
}
