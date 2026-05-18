import { cn } from '@/lib/utils'

interface Props {
  text:          string
  reading:       string
  className?:    string
  /** Passed through to the <ruby> element (use for inline font-size at hero scale). */
  style?:        React.CSSProperties
  /** Proportional rt size relative to parent font-size. Default 0.4em per DESIGN.md §Furigana Rule. */
  rtSize?:       string
  /**
   * Visibility of the rt reading hint.
   * 'hover' relies on the consumer adding `group` to a hover-trigger ancestor.
   */
  rtRevealMode?: 'always' | 'hover' | 'revealed'
}

export function FuriganaText({
  text,
  reading,
  className,
  style,
  rtSize       = '0.4em',
  rtRevealMode = 'always',
}: Props): React.JSX.Element {
  const opacityClass =
    rtRevealMode === 'hover' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'

  return (
    <ruby lang="ja" className={className} style={style}>
      {text}
      <rt
        className={cn(
          'font-japanese font-normal not-italic text-faded-sumi',
          'transition-opacity duration-200 ease-out motion-reduce:transition-none',
          opacityClass,
        )}
        style={{ fontSize: rtSize }}
      >
        {reading}
      </rt>
    </ruby>
  )
}
