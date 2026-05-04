interface Props {
  text:       string
  reading:    string
  className?: string
}

export function FuriganaText({ text, reading, className }: Props): React.JSX.Element {
  return (
    <ruby lang="ja" className={className}>
      {text}
      <rt className="text-xs font-normal not-italic">{reading}</rt>
    </ruby>
  )
}
