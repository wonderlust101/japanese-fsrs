import Link from 'next/link'

interface StateSwitcherProps {
  /** The currently-resolved page state. */
  current: string
  /** Currently-resolved note variant ('insight' | 'idiom'). */
  noteVariant: string
}

const PAGE_STATES = [
  { value: 'default',    label: 'Default'      },
  { value: 'caught-up',  label: 'Caught up'    },
  { value: 'first-time', label: 'First-time'   },
  { value: 'empty',      label: 'Empty'        },
  { value: 'loading',    label: 'Loading'      },
  { value: 'error',      label: 'Error'        },
] as const

const NOTE_VARIANTS = [
  { value: 'insight', label: 'Tomo note'  },
  { value: 'idiom',   label: 'Daily idiom' },
] as const

/**
 * Dev-only floating state switcher pinned to the bottom-center of the
 * viewport. Lets the design reviewer click between every page state +
 * Note from Tomo variant without typing URLs. Hidden in production.
 *
 * Renders fixed-position so it stays visible while scrolling. Soft warm-paper
 * pill with hairline border and subtle shadow so it reads as "dev chrome,"
 * not part of the design.
 */
export function StateSwitcher({ current, noteVariant }: StateSwitcherProps): React.JSX.Element | null {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <aside
      aria-label="Dashboard state preview"
      className={[
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-1 flex-wrap justify-center',
        'px-3 py-2 max-w-[calc(100vw-32px)]',
        'bg-warm-paper-raised border border-soft-hairline rounded-[8px]',
        'shadow-[0_4px_16px_rgba(70,30,35,0.10)]',
      ].join(' ')}
    >
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi mr-1.5">
        state
      </span>

      {PAGE_STATES.map((s) => (
        <Pill
          key={s.value}
          href={`?state=${s.value}${noteVariant !== 'insight' ? `&note=${noteVariant}` : ''}`}
          active={current === s.value}
        >
          {s.label}
        </Pill>
      ))}

      <span aria-hidden="true" className="mx-1 h-4 w-px bg-soft-hairline" />

      <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi mr-1">
        note
      </span>

      {NOTE_VARIANTS.map((n) => (
        <Pill
          key={n.value}
          href={`?state=${current}&note=${n.value}`}
          active={noteVariant === n.value}
        >
          {n.label}
        </Pill>
      ))}
    </aside>
  )
}

function Pill({
  href,
  active,
  children,
}: {
  href:     string
  active:   boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center px-2.5 h-7 rounded-[4px] text-xs font-medium',
        'transition-colors duration-150 ease-out',
        active
          ? 'bg-sumi-ink text-warm-paper-raised'
          : 'text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}
