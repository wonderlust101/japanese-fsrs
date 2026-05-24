import { Logo } from '@/components/ui/Logo'

interface TeacherQuotationProps {
  /** Main observation. Plain prose; the surrounding blockquote supplies
   *  the 「」 framing inline. */
  lead:   string
  /** Optional follow-up clause. Renders below the lead as a smaller faded-
   *  sumi footnote inside the same centered column. */
  aside?: string | null
  /** Color register for the bracket ornament. Defaults to `'vermillion'`
   *  (the brand red-ink teacher voice). Set to `'aizome'` when the parent
   *  SectionCard uses `stripeTone="aizome"` so the bracket color tracks
   *  the section chrome and the card reads as one coherent surface. */
  accent?: 'vermillion' | 'aizome'
}

const ACCENT_BRACKET_CLASS: Record<'vermillion' | 'aizome', string> = {
  vermillion: 'text-inari-vermillion/85',
  aizome:     'text-aizome-indigo/85',
}

// Card-container variant of TeacherNote. The quotation chrome itself
// (inline 「」 at 1.25em not-italic, vermillion/85) is identical to the
// Today page's TeacherNote — same size, same style, same cascade. The
// container is what differs:
//
//   - The blockquote is bounded to ~42ch and centered horizontally in
//     the figure, so short single-sentence diagnoses don't sprawl across
//     a wide card body.
//   - The kitsune anchors to the card's far right, vertically centered
//     against the prose and partially clipped past the SectionCard's
//     overflow edge — the same "ornament pressed past the margin"
//     gesture Japanese editorial layout uses for seals and marginalia.
//
// Scoped to the review summary's Session details card.
export function TeacherQuotation({
  lead,
  aside  = null,
  accent = 'vermillion',
}: TeacherQuotationProps): React.JSX.Element {
  // Split the lead so the closing bracket can be glued to the final word
  // via `whitespace-nowrap`. Without this guard, the styled bracket span
  // creates a wrap opportunity at the end of the prose — when the line
  // breaks just before it, the bracket lands alone on its own line, which
  // reads as a typesetting orphan.
  const lastSpace    = lead.lastIndexOf(' ')
  const proseHead    = lastSpace === -1 ? '' : lead.slice(0, lastSpace + 1)
  const proseTail    = lastSpace === -1 ? lead : lead.slice(lastSpace + 1)
  const bracketClass = ACCENT_BRACKET_CLASS[accent]

  return (
    <figure className="relative flex h-full min-h-[160px] flex-col justify-center py-6">
      <Logo
        size={180}
        showWordmark={false}
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 select-none opacity-[0.06]"
      />

      <div className="relative z-10 px-4">
        <blockquote
          cite="Tomo"
          className="italic break-words text-base leading-[1.55] text-sumi-ink sm:text-md"
        >
          <span
            aria-hidden="true"
            lang="ja"
            className={`mr-0.5 inline-block text-[1.25em] leading-none select-none not-italic ${bracketClass}`}
          >
            「
          </span>
          {proseHead}
          <span className="whitespace-nowrap">
            {proseTail}
            <span
              aria-hidden="true"
              lang="ja"
              className={`ml-0.5 inline-block text-[1.25em] leading-none select-none not-italic ${bracketClass}`}
            >
              」
            </span>
          </span>
        </blockquote>
        {aside !== null && aside.length > 0 && (
          <p className="mt-2 text-base italic leading-relaxed text-faded-sumi">
            {aside}
          </p>
        )}
      </div>
    </figure>
  )
}
