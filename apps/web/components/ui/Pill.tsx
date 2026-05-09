import { forwardRef } from 'react'

type PillSize = 'sm' | 'md' | 'lg'

type LevelTone   = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond' | 'kana'
type StatusTone  = 'success' | 'warning' | 'danger' | 'info' | 'muted'

type PillVariantProps =
  | { variant: 'level';        tone: LevelTone }
  | { variant: 'tag' }
  | { variant: 'status';       tone: StatusTone }
  | { variant: 'keyboard-key' }
  | { variant: 'interactive';  selected: boolean }

type PillCommonProps = {
  size?:        PillSize
  leadingNode?: React.ReactNode
  className?:   string
  children:     React.ReactNode
} & (
  | { variant: 'interactive'; onClick: () => void; ariaPressed?: boolean }
  | { variant?: Exclude<PillVariantProps['variant'], 'interactive'>; onClick?: never; ariaPressed?: never }
)

type PillProps = PillVariantProps & PillCommonProps

const sizeClasses: Record<PillSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-0.5 text-xs gap-1.5',
  lg: 'px-3 py-1 text-sm gap-1.5',
}

const levelClasses: Record<LevelTone, string> = {
  N5:     'bg-jlpt-n5-bg text-jlpt-n5-text',
  N4:     'bg-jlpt-n4-bg text-jlpt-n4-text',
  N3:     'bg-jlpt-n3-bg text-jlpt-n3-text',
  N2:     'bg-jlpt-n2-bg text-jlpt-n2-text',
  N1:     'bg-jlpt-n1-bg text-jlpt-n1-text',
  beyond: 'bg-jlpt-beyond-bg text-jlpt-beyond-text',
  kana:   'bg-cream-inset text-faded-sumi',
}

const statusClasses: Record<StatusTone, string> = {
  success: 'bg-jlpt-n5-bg text-jlpt-n5-text',
  warning: 'bg-jlpt-beyond-bg text-jlpt-beyond-text',
  danger:  'bg-vermillion-wash text-inari-vermillion-deep',
  info:    'bg-jlpt-n3-bg text-aizome-indigo',
  muted:   'bg-cream-inset text-faded-sumi',
}

export const Pill = forwardRef<HTMLSpanElement, PillProps>((props, ref) => {
  const size  = props.size ?? 'md'
  const sized = sizeClasses[size]
  const base  = 'inline-flex items-center font-medium rounded-full whitespace-nowrap'

  if (props.variant === 'interactive') {
    const { selected, onClick, ariaPressed, leadingNode, className = '', children } = props
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ariaPressed ?? selected}
        className={[
          base,
          sized,
          'border transition-colors duration-150 ease-out',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          selected
            ? 'border-inari-vermillion bg-transparent text-inari-vermillion'
            : 'border-soft-hairline bg-transparent text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset/40',
          className,
        ].join(' ')}
      >
        {leadingNode !== undefined && (
          <span aria-hidden="true" className="inline-flex">{leadingNode}</span>
        )}
        {children}
      </button>
    )
  }

  if (props.variant === 'keyboard-key') {
    const { leadingNode, className = '', children } = props
    return (
      <span
        ref={ref}
        className={[
          base,
          sized,
          'bg-warm-paper-raised text-sumi-ink border border-soft-hairline',
          'shadow-[inset_0_-1px_0_rgba(31,26,24,0.08)]',
          'font-mono tabular-nums tracking-tight',
          className,
        ].join(' ')}
      >
        {leadingNode !== undefined && (
          <span aria-hidden="true" className="inline-flex">{leadingNode}</span>
        )}
        {children}
      </span>
    )
  }

  let toneClass = ''
  if (props.variant === 'level')  toneClass = levelClasses[props.tone]
  if (props.variant === 'status') toneClass = statusClasses[props.tone]
  if (props.variant === 'tag' || props.variant === undefined) toneClass = 'bg-cream-inset text-faded-sumi'

  return (
    <span
      ref={ref}
      className={[base, sized, toneClass, props.className ?? ''].join(' ')}
    >
      {props.leadingNode !== undefined && (
        <span aria-hidden="true" className="inline-flex">{props.leadingNode}</span>
      )}
      {props.children}
    </span>
  )
})

Pill.displayName = 'Pill'
