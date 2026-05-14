'use client'

import { BASICINFO_META, BASICINFO_VARIANTS, type BasicInfoVariant } from './section-basicinfo'
import { CADENCE_META,   CADENCE_VARIANTS,   type CadenceVariant }   from './section-cadence'
import { CURRENTLY_META, CURRENTLY_VARIANTS, type CurrentlyVariant } from './section-currently'
import { MASTHEAD_META,  MASTHEAD_VARIANTS,  type MastheadVariant }  from './section-masthead'
import { SHELF_META,     SHELF_VARIANTS,     type ShelfVariant }     from './section-shelf'
import type { SectionVariants }   from './direction-sections'
import type { ProfileDirection }  from './profile-view'

export const PROFILE_TOOLBAR_TOGGLE_EVENT = 'tomo:profile-dev-tools:toggle'

interface ProfileDevToolbarProps {
  direction:               ProfileDirection
  minimized:               boolean
  sectionVariants:         SectionVariants
  onDirectionChange:       (next: ProfileDirection)    => void
  onMastheadChange:        (next: MastheadVariant)     => void
  onBasicInfoChange:       (next: BasicInfoVariant)    => void
  onCadenceChange:         (next: CadenceVariant)      => void
  onCurrentlyChange:       (next: CurrentlyVariant)    => void
  onShelfChange:           (next: ShelfVariant)        => void
  onMinimize:              () => void
  onExpand:                () => void
  onClose:                 () => void
}

interface VariantMeta { short: string; label: string; blurb: string }

type LegacyDirection = Exclude<ProfileDirection, 'sectioned'>

const LEGACY_META: Record<LegacyDirection, VariantMeta> = {
  stack:    { short: 'V1', label: 'Stack',    blurb: 'Three overlapping cards in a z-axis stack.' },
  solo:     { short: 'V2', label: 'Solo',     blurb: 'One large centered card, alone on the page.' },
  bento:    { short: 'V3', label: 'Bento',    blurb: 'Hero card with an asymmetric bento row below.' },
  roll:     { short: 'V4', label: 'Roll',     blurb: 'Identity card with a sidebar roll of small cards.' },
  postcard: { short: 'V5', label: 'Postcard', blurb: 'Single wide card with internal column composition.' },
  float:    { short: 'V6', label: 'Float',    blurb: 'Three cards positioned asymmetrically on the page.' },
}

const LEGACY_ORDER: readonly LegacyDirection[] = [
  'stack', 'solo', 'bento', 'roll', 'postcard', 'float',
]

/**
 * Profile dev toolbar. Two modes:
 *
 *   Sectioned (default): the canonical profile composition. Modules sit
 *                        inside the shared SectionCard primitive; the
 *                        toolbar exposes a per-section variant picker
 *                        for each of the five modules + the masthead.
 *   Legacy:              the original whole-page direction variants
 *                        (Stack/Solo/Bento/Roll/Postcard/Float). Kept
 *                        accessible so prior work isn't lost.
 *
 * Persistence (open/minimized state, direction, per-section variants)
 * lives in the parent ProfileView via localStorage; this component is
 * purely controlled.
 */
export function ProfileDevToolbar(props: ProfileDevToolbarProps): React.JSX.Element {
  const { direction, minimized } = props
  const showSectionPanel = direction === 'sectioned'

  if (minimized) {
    return <ToolbarPill direction={direction} onExpand={props.onExpand} />
  }

  return (
    <aside
      aria-label="Profile preview controls"
      className={[
        'fixed bottom-4 right-[4.5rem] z-40',
        'w-[min(22rem,calc(100vw-6rem))] rounded-[2px] border border-sumi-ink/15',
        'bg-sumi-ink text-warm-paper-raised shadow-lg',
        'flex flex-col max-h-[calc(100vh-2rem)]',
      ].join(' ')}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-warm-paper-raised/10 px-4 py-2.5">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em]">Profile preview</p>
        <div className="flex items-center gap-1">
          <ChromeButton onClick={props.onMinimize} ariaLabel="Minimize preview controls">
            <MinimizeGlyph />
          </ChromeButton>
          <ChromeButton onClick={props.onClose} ariaLabel="Close preview controls">
            <CloseGlyph />
          </ChromeButton>
        </div>
      </header>

      <div className="overflow-y-auto">
        <ModeToggle direction={direction} onDirectionChange={props.onDirectionChange} />

        {showSectionPanel ? (
          <SectionVariantPanel
            sectionVariants={props.sectionVariants}
            onMastheadChange={props.onMastheadChange}
            onBasicInfoChange={props.onBasicInfoChange}
            onCadenceChange={props.onCadenceChange}
            onCurrentlyChange={props.onCurrentlyChange}
            onShelfChange={props.onShelfChange}
          />
        ) : (
          <LegacyPanel direction={direction} onDirectionChange={props.onDirectionChange} />
        )}
      </div>
    </aside>
  )
}

function ToolbarPill({
  direction, onExpand,
}: { direction: ProfileDirection; onExpand: () => void }): React.JSX.Element {
  let label: string
  let short: string
  if (direction === 'sectioned') {
    label = 'Sectioned'
    short = 'SEC'
  } else {
    const meta = LEGACY_META[direction]
    label = meta.label
    short = meta.short
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={[
        'fixed bottom-4 right-[4.5rem] z-40',
        'inline-flex items-center gap-2 rounded-[2px] border border-sumi-ink/15',
        'bg-sumi-ink px-2.5 py-1.5 text-warm-paper-raised shadow-lg',
        'font-mono text-[0.625rem] uppercase tracking-[0.16em]',
        'hover:bg-sumi-ink/95 ui-motion-colors',
      ].join(' ')}
      aria-label="Expand profile preview controls"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion" />
      <span>{short}</span>
      <span className="text-warm-paper-raised/55">·</span>
      <span className="text-warm-paper-raised/85">{label}</span>
    </button>
  )
}

function ModeToggle({
  direction, onDirectionChange,
}: {
  direction:         ProfileDirection
  onDirectionChange: (next: ProfileDirection) => void
}): React.JSX.Element {
  const isSectioned = direction === 'sectioned'
  return (
    <div className="border-b border-warm-paper-raised/10 px-4 py-3">
      <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-warm-paper-raised/60">
        Mode
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <ModeButton
          active={isSectioned}
          onClick={() => onDirectionChange('sectioned')}
          short="SEC"
          label="Sectioned"
        />
        <ModeButton
          active={!isSectioned}
          onClick={() => onDirectionChange('stack')}
          short="L"
          label="Legacy"
        />
      </div>
    </div>
  )
}

function ModeButton({
  active, onClick, short, label,
}: {
  active:  boolean
  onClick: () => void
  short:   string
  label:   string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex flex-col items-center gap-0.5 rounded-[2px] border py-2',
        'font-mono uppercase tracking-[0.08em] ui-motion-colors',
        active
          ? 'border-inari-vermillion bg-inari-vermillion text-warm-paper-raised'
          : 'border-warm-paper-raised/15 bg-warm-paper-raised/5 text-warm-paper-raised hover:bg-warm-paper-raised/10',
      ].join(' ')}
    >
      <span className="text-[0.625rem] opacity-70">{short}</span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  )
}

function LegacyPanel({
  direction, onDirectionChange,
}: {
  direction:         ProfileDirection
  onDirectionChange: (next: ProfileDirection) => void
}): React.JSX.Element {
  const activeMeta = direction === 'sectioned' ? null : LEGACY_META[direction]

  return (
    <div className="space-y-3 px-4 py-3">
      <div>
        <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-warm-paper-raised/60">
          Whole-page direction
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {LEGACY_ORDER.map((value) => {
            const meta   = LEGACY_META[value]
            const active = value === direction
            return (
              <ModeButton
                key={value}
                active={active}
                onClick={() => onDirectionChange(value)}
                short={meta.short}
                label={meta.label}
              />
            )
          })}
        </div>
      </div>
      {activeMeta !== null && (
        <p className="text-[0.6875rem] leading-relaxed text-warm-paper-raised/65">
          {activeMeta.blurb}
        </p>
      )}
    </div>
  )
}

interface SectionPanelProps {
  sectionVariants:   SectionVariants
  onMastheadChange:  (next: MastheadVariant)  => void
  onBasicInfoChange: (next: BasicInfoVariant) => void
  onCadenceChange:   (next: CadenceVariant)   => void
  onCurrentlyChange: (next: CurrentlyVariant) => void
  onShelfChange:     (next: ShelfVariant)     => void
}

function SectionVariantPanel(props: SectionPanelProps): React.JSX.Element {
  return (
    <div className="space-y-4 px-4 py-3">
      <SectionPicker
        title="Masthead"
        active={props.sectionVariants.masthead}
        order={MASTHEAD_VARIANTS}
        meta={MASTHEAD_META}
        onChange={props.onMastheadChange}
      />
      <SectionPicker
        title="Basic info"
        active={props.sectionVariants.basicInfo}
        order={BASICINFO_VARIANTS}
        meta={BASICINFO_META}
        onChange={props.onBasicInfoChange}
      />
      <SectionPicker
        title="Cadence"
        active={props.sectionVariants.cadence}
        order={CADENCE_VARIANTS}
        meta={CADENCE_META}
        onChange={props.onCadenceChange}
      />
      <SectionPicker
        title="Currently"
        active={props.sectionVariants.currently}
        order={CURRENTLY_VARIANTS}
        meta={CURRENTLY_META}
        onChange={props.onCurrentlyChange}
      />
      <SectionPicker
        title="Shared decks"
        active={props.sectionVariants.shelf}
        order={SHELF_VARIANTS}
        meta={SHELF_META}
        onChange={props.onShelfChange}
      />
    </div>
  )
}

interface SectionPickerProps<V extends string> {
  title:    string
  active:   V
  order:    readonly V[]
  meta:     Record<V, VariantMeta>
  onChange: (next: V) => void
}

function SectionPicker<V extends string>({
  title, active, order, meta, onChange,
}: SectionPickerProps<V>): React.JSX.Element {
  const activeMeta = meta[active]
  return (
    <div>
      <p className="mb-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-warm-paper-raised/60">
        {title}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {order.map((value) => {
          const m = meta[value]
          const isActive = value === active
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              aria-pressed={isActive}
              className={[
                'flex flex-col items-center gap-0.5 rounded-[2px] border py-1.5',
                'font-mono uppercase tracking-[0.08em] ui-motion-colors',
                isActive
                  ? 'border-inari-vermillion bg-inari-vermillion text-warm-paper-raised'
                  : 'border-warm-paper-raised/15 bg-warm-paper-raised/5 text-warm-paper-raised hover:bg-warm-paper-raised/10',
              ].join(' ')}
            >
              <span className="text-[0.5625rem] opacity-70">{m.short}</span>
              <span className="text-[0.6875rem] font-semibold leading-tight">{m.label}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[0.6875rem] leading-snug text-warm-paper-raised/55">
        {activeMeta.blurb}
      </p>
    </div>
  )
}

function ChromeButton({
  onClick, ariaLabel, children,
}: {
  onClick:   () => void
  ariaLabel: string
  children:  React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded-[2px]',
        'text-warm-paper-raised/70 hover:bg-warm-paper-raised/10 hover:text-warm-paper-raised',
        'ui-motion-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-warm-paper-raised',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function MinimizeGlyph(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 9h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function CloseGlyph(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}
