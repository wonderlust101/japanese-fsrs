import { Children, forwardRef } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type PillSize = 'sm' | 'md' | 'lg'

export type JlptPillLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond' | 'beyond_jlpt' | 'kana'
export type ContentTypeTone = 'vocabulary' | 'kanji' | 'grammar' | 'sentence' | 'mixed' | 'kana'
export type StatusTone =
  | 'new'
  | 'due'
  | 'learning'
  | 'review'
  | 'mastered'
  | 'weakSpot'
  | 'suspended'
  | 'subscribed'
  | 'premade'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'

type PillVariantProps =
  | { variant: 'level'; tone: JlptPillLevel }
  | { variant: 'content-type'; tone: ContentTypeTone }
  | { variant: 'tag' }
  | { variant: 'status'; tone: StatusTone }
  | { variant: 'keyboard-key' }
  | { variant: 'interactive'; selected: boolean }

type PillCommonProps = {
  size?:        PillSize
  leadingNode?: ReactNode
  mark?:        ReactNode
  ariaLabel?:   string
  className?:   string
  children:     ReactNode
} & (
  | { variant: 'interactive'; onClick: () => void; ariaPressed?: boolean }
  | { variant?: Exclude<PillVariantProps['variant'], 'interactive'>; onClick?: never; ariaPressed?: never }
)

export type PillProps = PillVariantProps & PillCommonProps

type SemanticTone = {
  className: string
  mark:      ReactNode
}

const sizeClasses: Record<PillSize, string> = {
  sm: 'min-h-5 px-2 py-0.5 text-xs gap-1',
  md: 'min-h-6 px-2.5 py-0.5 text-xs gap-2',
  lg: 'min-h-7 px-3 py-1 text-sm gap-2',
}

const labelClasses: Record<PillSize, string> = {
  sm: 'max-w-[8rem]',
  md: 'max-w-[10rem]',
  lg: 'max-w-[12rem]',
}

const levelClasses: Record<JlptPillLevel, string> = {
  N5:          'border-deck-n5-mark/25 bg-deck-n5-wash text-deck-n5-mark',
  N4:          'border-deck-n4-mark/25 bg-deck-n4-wash text-deck-n4-mark',
  N3:          'border-deck-n3-mark/25 bg-deck-n3-wash text-deck-n3-mark',
  N2:          'border-deck-n2-mark/25 bg-deck-n2-wash text-deck-n2-mark',
  N1:          'border-deck-n1-mark/25 bg-deck-n1-wash text-deck-n1-mark',
  beyond:      'border-deck-beyond-mark/25 bg-deck-beyond-wash text-deck-beyond-mark',
  beyond_jlpt: 'border-deck-beyond-mark/25 bg-deck-beyond-wash text-deck-beyond-mark',
  kana:        'border-soft-hairline bg-cream-inset text-faded-sumi',
}

const contentTypeTones: Record<ContentTypeTone, SemanticTone> = {
  vocabulary: { className: 'border-deck-n3-mark/25 bg-deck-n3-wash text-deck-n3-mark', mark: '語' },
  kanji:      { className: 'border-inari-vermillion/25 bg-vermillion-wash text-inari-vermillion-deep', mark: '漢' },
  grammar:    { className: 'border-deck-beyond-mark/25 bg-deck-beyond-wash text-deck-beyond-mark', mark: '文' },
  sentence:   { className: 'border-deck-n5-mark/25 bg-deck-n5-wash text-deck-n5-mark', mark: '例' },
  mixed:      { className: 'border-soft-hairline bg-cream-inset text-faded-sumi', mark: '混' },
  kana:       { className: 'border-deck-n4-mark/25 bg-deck-n4-wash text-deck-n4-mark', mark: 'か' },
}

const statusTones: Record<StatusTone, SemanticTone> = {
  new:        { className: 'border-deck-n5-mark/25 bg-deck-n5-wash text-deck-n5-mark', mark: '+' },
  due:        { className: 'border-inari-vermillion/25 bg-vermillion-wash text-inari-vermillion-deep', mark: '•' },
  learning:   { className: 'border-deck-beyond-mark/25 bg-deck-beyond-wash text-deck-beyond-mark', mark: '◐' },
  review:     { className: 'border-deck-n3-mark/25 bg-deck-n3-wash text-deck-n3-mark', mark: '↻' },
  mastered:   { className: 'border-deck-n5-mark/25 bg-deck-n5-wash text-deck-n5-mark', mark: '✓' },
  weakSpot:      { className: 'border-error/25 bg-error-tint text-error-deep', mark: '!' },
  suspended:  { className: 'border-soft-hairline bg-cream-inset text-faded-sumi', mark: '×' },
  subscribed: { className: 'border-deck-n5-mark/25 bg-deck-n5-wash text-deck-n5-mark', mark: '✓' },
  premade:    { className: 'border-deck-beyond-mark/25 bg-deck-beyond-wash text-deck-beyond-mark', mark: '•' },
  success:    { className: 'border-deck-n5-mark/25 bg-deck-n5-wash text-deck-n5-mark', mark: '✓' },
  warning:    { className: 'border-deck-beyond-mark/25 bg-deck-beyond-wash text-deck-beyond-mark', mark: '!' },
  danger:     { className: 'border-error/25 bg-error-tint text-error-deep', mark: '!' },
  info:       { className: 'border-deck-n3-mark/25 bg-deck-n3-wash text-deck-n3-mark', mark: 'i' },
  muted:      { className: 'border-soft-hairline bg-cream-inset text-faded-sumi', mark: '•' },
}

const levelMark = '#'

function normalizeLevel(level: JlptPillLevel): JlptPillLevel {
  return level === 'beyond_jlpt' ? 'beyond' : level
}

function defaultJlptLabel(level: JlptPillLevel): string {
  const normalized = normalizeLevel(level)
  if (normalized === 'beyond') return 'Beyond'
  if (normalized === 'kana') return 'Kana'
  return normalized
}

function defaultJlptAriaLabel(level: JlptPillLevel, label: string): string {
  const normalized = normalizeLevel(level)
  if (normalized === 'kana') return 'Kana'
  if (normalized === 'beyond') return 'Beyond JLPT'
  return `JLPT ${label}`
}

function labelFromTone(tone: string): string {
  return tone
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function defaultStatusLabel(status: StatusTone): string {
  switch (status) {
    case 'new':        return 'New'
    case 'due':        return 'Due'
    case 'review':     return 'Review'
    case 'mastered':   return 'Mastered'
    case 'weakSpot':      return 'Weak spot'
    case 'suspended':  return 'Suspended'
    default:           return labelFromTone(status)
  }
}

function renderMark(mark: ReactNode): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center font-mono text-sm font-semibold leading-none opacity-80"
    >
      {mark}
    </span>
  )
}

function renderChildren(children: ReactNode, size: PillSize): React.JSX.Element {
  return (
    <span className={cn('min-w-0 truncate', labelClasses[size])}>
      {children}
    </span>
  )
}

export const Pill = forwardRef<HTMLSpanElement, PillProps>((props, ref) => {
  const size  = props.size ?? 'md'
  const sized = sizeClasses[size]
  const base  = 'inline-flex max-w-full items-center rounded-full border font-medium leading-none whitespace-nowrap'

  if (props.variant === 'interactive') {
    const {
      selected,
      onClick,
      ariaPressed,
      leadingNode,
      mark,
      ariaLabel,
      className = '',
      children,
    } = props

    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ariaPressed ?? selected}
        aria-label={ariaLabel}
        className={cn(
          base,
          sized,
          'ui-motion-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          selected
            ? 'border-inari-vermillion/35 bg-vermillion-wash text-inari-vermillion-deep'
            : 'border-soft-hairline bg-cream-inset text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink',
          className,
        )}
      >
        {leadingNode !== undefined && (
          <span aria-hidden="true" className="inline-flex shrink-0">{leadingNode}</span>
        )}
        {mark !== undefined && renderMark(mark)}
        {renderChildren(children, size)}
      </button>
    )
  }

  if (props.variant === 'keyboard-key') {
    const { leadingNode, mark, ariaLabel, className = '', children } = props
    return (
      <span
        ref={ref}
        aria-label={ariaLabel}
        className={cn(
          base,
          sized,
          'border-soft-hairline bg-warm-paper-raised text-sumi-ink',
          'shadow-[inset_0_-1px_0_rgba(31,26,24,0.08)]',
          'font-mono tabular-nums tracking-tight',
          className,
        )}
      >
        {leadingNode !== undefined && (
          <span aria-hidden="true" className="inline-flex shrink-0">{leadingNode}</span>
        )}
        {mark !== undefined && renderMark(mark)}
        {renderChildren(children, size)}
      </span>
    )
  }

  let toneClass = ''
  let mark: ReactNode = props.mark

  if (props.variant === 'level') {
    toneClass = levelClasses[props.tone]
    mark ??= levelMark
  }
  if (props.variant === 'content-type') {
    const tone = contentTypeTones[props.tone]
    toneClass = tone.className
    mark ??= tone.mark
  }
  if (props.variant === 'status') {
    const tone = statusTones[props.tone]
    toneClass = tone.className
    mark ??= tone.mark
  }
  if (props.variant === 'tag' || props.variant === undefined) {
    toneClass = 'border-soft-hairline bg-cream-inset text-faded-sumi'
  }

  return (
    <span
      ref={ref}
      aria-label={props.ariaLabel}
      className={cn(base, sized, toneClass, props.className)}
    >
      {props.leadingNode !== undefined && (
        <span aria-hidden="true" className="inline-flex shrink-0">{props.leadingNode}</span>
      )}
      {mark !== undefined && renderMark(mark)}
      {renderChildren(props.children, size)}
    </span>
  )
})

Pill.displayName = 'Pill'

export function JlptPill({
  level,
  label = defaultJlptLabel(level),
  size = 'md',
  className = '',
}: {
  level:      JlptPillLevel
  label?:     string
  size?:      PillSize
  className?: string
}): React.JSX.Element {
  return (
    <Pill
      variant="level"
      tone={level}
      size={size}
      ariaLabel={defaultJlptAriaLabel(level, label)}
      className={className}
    >
      {label}
    </Pill>
  )
}

export function StatusPill({
  status,
  label = defaultStatusLabel(status),
  size = 'md',
  className = '',
}: {
  status:     StatusTone
  label?:     string
  size?:      PillSize
  className?: string
}): React.JSX.Element {
  return (
    <Pill
      variant="status"
      tone={status}
      size={size}
      ariaLabel={`Status ${label}`}
      className={className}
    >
      {label}
    </Pill>
  )
}

export function ContentTypePill({
  type,
  label = labelFromTone(type),
  size = 'md',
  className = '',
}: {
  type:       ContentTypeTone
  label?:     string
  size?:      PillSize
  className?: string
}): React.JSX.Element {
  return (
    <Pill
      variant="content-type"
      tone={type}
      size={size}
      ariaLabel={`Content type ${label}`}
      className={className}
    >
      {label}
    </Pill>
  )
}

export function PillGroup({
  children,
  maxVisible,
  overflowLabel,
  compact = false,
  wrap = true,
  className,
}: {
  children:       ReactNode
  maxVisible?:    number
  overflowLabel?: string
  compact?:       boolean
  wrap?:          boolean
  className?:     string
}): React.JSX.Element {
  const items        = Children.toArray(children).filter(Boolean)
  const visibleItems = maxVisible === undefined ? items : items.slice(0, maxVisible)
  const hiddenCount  = maxVisible === undefined ? 0 : Math.max(0, items.length - maxVisible)

  return (
    <div
      className={cn(
        'flex min-w-0 items-center',
        wrap ? 'flex-wrap' : 'overflow-hidden',
        compact ? 'gap-1' : 'gap-2',
        className,
      )}
    >
      {visibleItems}
      {hiddenCount > 0 && (
        <Pill variant="tag" size="sm" ariaLabel={overflowLabel ?? `${hiddenCount} more labels`}>
          +{hiddenCount}
        </Pill>
      )}
    </div>
  )
}
