/**
 * Chrome Marks: brand-aligned ink-stroke icon family for chrome surfaces.
 * Extends the existing onboarding icon system (study-marks, dashboard-marks,
 * arrow-glyph) with shapes that bake in Tomo brand devices.
 *
 * Brand alignment:
 *   - Tomo card top-stripe (the brand's signature device, filled
 *     currentColor at 2.5 units tall) inside card-bodied icons.
 *   - Hi-no-maru focal discs (filled currentColor circles) at the visual
 *     center of icons where a "focal sun/disc" reads as right.
 *   - Kanji-stroke weight rhythm (1.0–1.4× variation within a single icon).
 *   - Tategaki (vertical) text suggestion lines on cards and bubbles.
 *   - Sangaku mountain peaks, mizuhiki knots, fūrin tanzaku, wahon binding
 *     dots, torii with shimenawa hint, kasumi cloud, chochin lantern.
 *
 * Construction:
 *   - viewBox 40x40, currentColor, fill="none" on outlined paths.
 *   - 1.125 primary stroke, round linecap, round linejoin.
 *   - Secondary detail lines at `STROKE * 0.6` and `opacity="0.65"`.
 *   - Small filled focal dots at `fill="currentColor" stroke="none"`.
 *
 * Color discipline inherits from the parent row:
 *   - Default rest: parent uses `text-faded-sumi`
 *   - Hover: parent transitions to `text-sumi-ink` (plus row bg tints)
 *   - Active route: parent uses `text-inari-vermillion` (plus row bg)
 *
 * Icons are static: no hover motion, no animation. State is communicated
 * entirely via inherited color shifts on the parent row.
 */

const STROKE = 1.25

const COMMON_PROPS = {
  fill:           'none',
  stroke:         'currentColor',
  strokeWidth:    STROKE,
  strokeLinecap:  'round',
  strokeLinejoin: 'round',
} as const

interface IconProps {
  className?: string
}

// ── Nav (5) ──────────────────────────────────────────────────────────────

/** Dashboard. 田 grid with hi-no-maru disc in top-left cell. */
export function IconDashboard({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="8" y="8" width="24" height="24" {...COMMON_PROPS} />
      <line x1="20" y1="8" x2="20" y2="32" {...COMMON_PROPS} />
      <line x1="8" y1="20" x2="32" y2="20" {...COMMON_PROPS} />
      <circle cx="14" cy="14" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Review. Card with Tomo top-stripe (brand device) + tategaki text. */
export function IconReview({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="9" y="6" width="22" height="28" rx="1" {...COMMON_PROPS} />
      <rect x="9" y="6" width="22" height="2.5" fill="currentColor" stroke="none" />
      <path d="M 25 14 V 29 M 20 14 V 26 M 15 14 V 28" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
    </svg>
  )
}

/** Decks. Stacked cards with Tomo top-stripe on the front + tategaki. */
export function IconDecks({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 14 8 H 30 M 11 12 H 31" {...COMMON_PROPS} />
      <rect x="8" y="16" width="24" height="18" rx="1" {...COMMON_PROPS} />
      <rect x="8" y="16" width="24" height="2.5" fill="currentColor" stroke="none" />
      <path d="M 26 22 V 32 M 20 22 V 30 M 14 22 V 32" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} opacity="0.65" />
    </svg>
  )
}

/** Browse. Tansu with all 3 drawer handles (middle larger, brand-focal). */
export function IconBrowse({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="8" y="8" width="24" height="24" {...COMMON_PROPS} />
      <path d="M 8 16 H 32 M 8 24 H 32" {...COMMON_PROPS} />
      <circle cx="20" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="20" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="20" cy="28" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Analytics. Sangaku peaks with filled hi-no-maru sun behind central peak. */
export function IconAnalytics({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="28" cy="11" r="3.2" fill="currentColor" stroke="none" />
      <path d="M 5 32 L 10 22 L 14 28 L 20 12 L 26 28 L 30 20 L 35 32" {...COMMON_PROPS} />
    </svg>
  )
}

// ── Account menu (4) ─────────────────────────────────────────────────────

/** Profile. Person with kimono V-collar detail. */
export function IconProfile({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="20" cy="14" r="6" {...COMMON_PROPS} />
      <path d="M 7 33 V 25 H 33 V 33" {...COMMON_PROPS} />
      <path d="M 16 25 L 20 30 L 24 25" {...COMMON_PROPS} strokeWidth={STROKE * 0.75} />
    </svg>
  )
}

/** Settings. Butterfly mizuhiki bow knot with center jewel. */
export function IconSettings({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 6 20 H 14 M 26 20 H 34" {...COMMON_PROPS} />
      <path d="M 14 14 L 20 20 L 14 26 Z" {...COMMON_PROPS} />
      <path d="M 26 14 L 20 20 L 26 26 Z" {...COMMON_PROPS} />
      <circle cx="20" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Report a bug. Speech bubble + tategaki content + ku-ten dot. */
export function IconReportBug({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 9 8 L 31 8 Q 33 8 33 10 L 33 22 Q 33 24 31 24 L 18 24 L 14 30 L 14 24 L 9 24 Q 7 24 7 22 L 7 10 Q 7 8 9 8 Z" {...COMMON_PROPS} />
      <path d="M 26 12 V 21 M 21 12 V 19 M 16 12 V 20" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
      <circle cx="11" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Sign out. Torii with subtle shimenawa rope drape. */
export function IconSignOut({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 6 11 H 34" {...COMMON_PROPS} />
      <path d="M 9 14 H 31" {...COMMON_PROPS} />
      <path d="M 12 11 V 33 M 28 11 V 33" {...COMMON_PROPS} />
      <path d="M 12 19 Q 20 22 28 19" {...COMMON_PROPS} strokeWidth={STROKE * 0.75} opacity="0.7" />
    </svg>
  )
}

// ── Status (3) ───────────────────────────────────────────────────────────

/** Notifications. Fūrin with detailed dome band + tanzaku + content dot. */
export function IconNotifications({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="20" y1="5" x2="20" y2="9" {...COMMON_PROPS} />
      <path d="M 13 17 Q 13 9 20 9 Q 27 9 27 17 Z" {...COMMON_PROPS} />
      <line x1="13" y1="14" x2="27" y2="14" {...COMMON_PROPS} strokeWidth={STROKE * 0.5} opacity="0.65" />
      <path d="M 20 17 V 21 M 16 21 H 24 V 31 H 16 Z" {...COMMON_PROPS} />
      <circle cx="20" cy="26" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Offline. Stylized kasumi cloud silhouette with horizontal break. */
export function IconOffline({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 6 18 Q 6 13 11 14 Q 14 11 19 13 Q 26 12 27 17 Q 33 16 34 22 Q 34 28 28 28 Q 22 30 18 28 Q 11 29 9 24 Q 5 22 6 18 Z" {...COMMON_PROPS} />
      <line x1="9" y1="22" x2="31" y2="22" {...COMMON_PROPS} />
    </svg>
  )
}

/** Search. Magnifier with filled hi-no-maru lens disc. */
export function IconSearch({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="17" cy="17" r="9" {...COMMON_PROPS} />
      <line x1="24" y1="24" x2="33" y2="33" {...COMMON_PROPS} />
      <circle cx="17" cy="17" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── Drawer (2) ───────────────────────────────────────────────────────────

/** Hamburger. Three brush strokes with calligraphic length variation. */
export function IconHamburger({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="7"  y1="13" x2="33" y2="13" {...COMMON_PROPS} />
      <line x1="10" y1="20" x2="30" y2="20" {...COMMON_PROPS} strokeWidth={STROKE * 0.75} />
      <line x1="6"  y1="27" x2="34" y2="27" {...COMMON_PROPS} />
    </svg>
  )
}

/** Close. X with kanji-stroke weight contrast. */
export function IconClose({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="11" y1="11" x2="29" y2="29" {...COMMON_PROPS} strokeWidth={STROKE * 1.2} />
      <line x1="29" y1="11" x2="11" y2="29" {...COMMON_PROPS} strokeWidth={STROKE * 0.7} />
    </svg>
  )
}

// ── Topbar (2) ───────────────────────────────────────────────────────────

/** Help. Question mark with pronounced kanji-stroke weighting + dot. */
export function IconHelp({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="12" {...COMMON_PROPS} />
      <path d="M 15 16 Q 15 11 20 11 Q 25 11 25 16 Q 25 19 22 20 L 20 22" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <circle cx="20" cy="27" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Plus. 十 kanji with calligraphic terminal taper. */
export function IconPlus({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="11" y1="19" x2="29" y2="19" {...COMMON_PROPS} />
      <line x1="20" y1="7" x2="20" y2="31" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <circle cx="20" cy="31" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── Action (5) ───────────────────────────────────────────────────────────

/** Play. Triangle with kanji-stroke weight + entry dot. */
export function IconPlay({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 13 8 L 33 20 L 13 32 Z" {...COMMON_PROPS} strokeWidth={STROKE * 1.15} />
      <circle cx="13" cy="20" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Pause. Two heavier kanji-stroke vertical bars. */
export function IconPause({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="15" y1="8" x2="15" y2="32" {...COMMON_PROPS} strokeWidth={STROKE * 1.5} />
      <line x1="25" y1="8" x2="25" y2="32" {...COMMON_PROPS} strokeWidth={STROKE * 1.5} />
    </svg>
  )
}

/** Skip. Two triangles with kanji-stroke weight. */
export function IconSkip({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 6 10 L 18 20 L 6 30 Z M 19 10 L 31 20 L 19 30 Z" {...COMMON_PROPS} strokeWidth={STROKE * 1.15} />
    </svg>
  )
}

/** Reveal. Eye with calligraphic upper lid + filled pupil. */
export function IconReveal({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 5 20 Q 12 9 20 9 Q 28 9 35 20" {...COMMON_PROPS} strokeWidth={STROKE * 1.2} />
      <path d="M 5 20 Q 12 30 20 30 Q 28 30 35 20" {...COMMON_PROPS} />
      <circle cx="20" cy="20" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Hide. Closed eye with calligraphic brush curve + lash marks. */
export function IconHide({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 5 17 Q 12 30 20 30 Q 28 30 35 17" {...COMMON_PROPS} strokeWidth={STROKE * 1.15} />
      <path d="M 11 27 L 9 31 M 20 30 V 33 M 29 27 L 31 31" {...COMMON_PROPS} strokeWidth={STROKE * 0.65} />
    </svg>
  )
}

// ── Edit (5) ─────────────────────────────────────────────────────────────

/** AddCard. Card with Tomo top-stripe + kanji-weight + sign. */
export function IconAddCard({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="9" y="6" width="22" height="28" rx="1" {...COMMON_PROPS} />
      <rect x="9" y="6" width="22" height="2.5" fill="currentColor" stroke="none" />
      <line x1="20" y1="16" x2="20" y2="28" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <line x1="14" y1="22" x2="26" y2="22" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
    </svg>
  )
}

/** Edit. Calligraphy brush (fude) with bamboo cap detail. */
export function IconEdit({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 26 6 Q 30 6 32 8 L 14 32 L 6 34 L 8 26 Z" {...COMMON_PROPS} />
      <path d="M 26 6 L 26 12 L 22 12" {...COMMON_PROPS} strokeWidth={STROKE * 0.75} />
    </svg>
  )
}

/** Delete. Trash with subtle kanji-stroke X marker inside. */
export function IconDelete({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 8 10 H 32 M 17 6 H 23" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <path d="M 10 10 V 32 Q 10 34 12 34 H 28 Q 30 34 30 32 V 10" {...COMMON_PROPS} />
      <path d="M 17 16 L 23 28 M 23 16 L 17 28" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
    </svg>
  )
}

/** Save. Bookmark with Tomo top-stripe band. */
export function IconSave({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 12 6 H 28 V 34 L 20 26 L 12 34 Z" {...COMMON_PROPS} />
      <rect x="12" y="6" width="16" height="2.5" fill="currentColor" stroke="none" />
      <line x1="20" y1="14" x2="20" y2="22" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} opacity="0.65" />
    </svg>
  )
}

/** Copy. Two cards with Tomo top-stripe overlapping. */
export function IconCopy({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="6" y="12" width="20" height="22" rx="1" {...COMMON_PROPS} />
      <rect x="6" y="12" width="20" height="2.5" fill="currentColor" stroke="none" />
      <path d="M 14 12 V 6 H 34 V 26 H 26" {...COMMON_PROPS} />
    </svg>
  )
}

// ── Data (5) ─────────────────────────────────────────────────────────────

/** Tag. Omamori (charm) shape with cord knot at top. */
export function IconTag({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 14 4 Q 14 8 18 8 H 22 Q 26 8 26 4" {...COMMON_PROPS} strokeWidth={STROKE * 0.7} />
      <line x1="20" y1="6" x2="20" y2="10" {...COMMON_PROPS} />
      <path d="M 11 10 H 29 V 32 Q 29 34 27 34 H 13 Q 11 34 11 32 Z" {...COMMON_PROPS} />
      <line x1="15" y1="18" x2="25" y2="18" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} opacity="0.65" />
    </svg>
  )
}

/** Filter. Funnel with thicker decorated top band. */
export function IconFilter({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 8 8 H 32 L 22 22 V 32 L 18 32 V 22 Z" {...COMMON_PROPS} />
      <line x1="6" y1="6" x2="34" y2="6" {...COMMON_PROPS} strokeWidth={STROKE * 1.25} />
    </svg>
  )
}

/** Sort. Three ofuda strips of decreasing width. */
export function IconSort({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="8" y="9"  width="24" height="5" {...COMMON_PROPS} />
      <rect x="8" y="17" width="18" height="5" {...COMMON_PROPS} />
      <rect x="8" y="25" width="12" height="5" {...COMMON_PROPS} />
    </svg>
  )
}

/** Calendar. Calendar with Tomo header band + binder rings + date dot. */
export function IconCalendar({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="6" y="8" width="28" height="26" rx="1" {...COMMON_PROPS} />
      <rect x="6" y="8" width="28" height="6" fill="currentColor" stroke="none" />
      <path d="M 13 5 V 11 M 27 5 V 11" {...COMMON_PROPS} strokeWidth={STROKE * 0.7} />
      <circle cx="20" cy="24" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Clock. Kanji-weight hour hand + thin minute hand + cardinal ticks. */
export function IconClock({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="13" {...COMMON_PROPS} />
      <line x1="20" y1="20" x2="20" y2="11" {...COMMON_PROPS} strokeWidth={STROKE * 1.2} />
      <line x1="20" y1="20" x2="27" y2="20" {...COMMON_PROPS} strokeWidth={STROKE * 0.7} />
      <path d="M 20 8 V 10 M 30 18 H 32 M 20 30 V 32 M 8 18 H 10" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} />
    </svg>
  )
}

// ── Feedback (5) ─────────────────────────────────────────────────────────

/** Check. Heavier brushstroke check. */
export function IconCheck({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 7 20 L 16 28 L 33 11" {...COMMON_PROPS} strokeWidth={STROKE * 1.4} />
    </svg>
  )
}

/** Cross. Heavier X with kanji-stroke weight contrast. */
export function IconCross({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="10" y1="10" x2="30" y2="30" {...COMMON_PROPS} strokeWidth={STROKE * 1.4} />
      <line x1="30" y1="10" x2="10" y2="30" {...COMMON_PROPS} strokeWidth={STROKE * 1.0} />
    </svg>
  )
}

/** Warning. Triangle with kanji-weight ! + brushstroke dot. */
export function IconWarning({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 20 5 L 35 32 L 5 32 Z" {...COMMON_PROPS} strokeWidth={STROKE * 1.15} />
      <path d="M 20 14 V 24" {...COMMON_PROPS} strokeWidth={STROKE * 1.3} />
      <circle cx="20" cy="28" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Info. Hi-no-maru disc + kanji-stroke i (brand-coded). */
export function IconInfo({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="13" {...COMMON_PROPS} strokeWidth={STROKE * 1.2} />
      <circle cx="20" cy="13" r="1.3" fill="currentColor" stroke="none" />
      <line x1="20" y1="18" x2="20" y2="28" {...COMMON_PROPS} strokeWidth={STROKE * 1.3} />
    </svg>
  )
}

/** More. Three brush dots with center slightly larger. */
export function IconMore({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="10" cy="20" r="2"   fill="currentColor" stroke="none" />
      <circle cx="20" cy="20" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="30" cy="20" r="2"   fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── Progress (5) ─────────────────────────────────────────────────────────

/** Star. Five-point star at kanji-stroke weight. */
export function IconStar({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 20 5 L 24 16 L 35 16 L 26 23 L 30 34 L 20 27 L 10 34 L 14 23 L 5 16 L 16 16 Z" {...COMMON_PROPS} strokeWidth={STROKE * 1.15} />
    </svg>
  )
}

/** Flag. Nobori vertical banner with tategaki content lines. */
export function IconFlag({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="14" y1="5" x2="14" y2="35" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <rect x="14" y="6" width="14" height="22" {...COMMON_PROPS} />
      <path d="M 18 11 V 23 M 22 11 V 23" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
    </svg>
  )
}

/** Streak. Flame with kanji 火 inner stroke. */
export function IconStreak({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 20 5 Q 12 14 16 22 Q 7 19 10 28 Q 13 35 20 35 Q 28 35 30 28 Q 32 19 24 22 Q 28 14 20 5 Z" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <path d="M 18 22 Q 20 27 22 22" {...COMMON_PROPS} strokeWidth={STROKE * 0.75} />
    </svg>
  )
}

/** Trophy. Rice bowl with curved Asian-style handles + plinth. */
export function IconTrophy({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 10 9 H 30 V 18 Q 30 25 22 26 V 30 H 18 V 26 Q 10 25 10 18 Z" {...COMMON_PROPS} />
      <path d="M 6 11 Q 6 18 10 18 M 30 18 Q 34 18 34 11" {...COMMON_PROPS} strokeWidth={STROKE * 0.8} />
      <path d="M 11 33 H 29 M 14 36 H 26" {...COMMON_PROPS} />
    </svg>
  )
}

/** Target. Hi-no-maru disc + concentric rings + cardinal ticks. */
export function IconTarget({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="13" {...COMMON_PROPS} />
      <circle cx="20" cy="20" r="6" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <circle cx="20" cy="20" r="2.5" fill="currentColor" stroke="none" />
      <path d="M 20 4 V 7 M 36 20 H 33 M 20 36 V 33 M 4 20 H 7" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} />
    </svg>
  )
}

// ── Language / Media (5) ─────────────────────────────────────────────────

/** Speaker. Speaker with calligraphic curve sound waves. */
export function IconSpeaker({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 6 14 H 12 L 20 7 V 33 L 12 26 H 6 Z" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <path d="M 25 14 Q 30 20 25 26" {...COMMON_PROPS} />
      <path d="M 30 9 Q 37 20 30 31" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.6" />
    </svg>
  )
}

/** Microphone. Microphone with kanji-weight capsule. */
export function IconMicrophone({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="15" y="5" width="10" height="18" rx="5" {...COMMON_PROPS} strokeWidth={STROKE * 1.1} />
      <path d="M 9 18 Q 9 27 20 27 Q 31 27 31 18" {...COMMON_PROPS} />
      <line x1="20" y1="27" x2="20" y2="33" {...COMMON_PROPS} />
      <line x1="13" y1="33" x2="27" y2="33" {...COMMON_PROPS} strokeWidth={STROKE * 0.75} />
    </svg>
  )
}

/** Translate. Serif A + kana あ + brushstroke arrow. */
export function IconTranslate({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <text x="4" y="20" fontSize="13" fontFamily="serif" fontWeight="600" fill="currentColor">A</text>
      <text x="23" y="34" fontSize="13" fontFamily="serif" fontWeight="600" fill="currentColor">あ</text>
      <path d="M 18 26 L 22 30 M 22 22 L 22 30 L 30 30" {...COMMON_PROPS} strokeWidth={STROKE * 0.7} />
    </svg>
  )
}

/** Dictionary. Wahon bound book with calligraphic spine + tategaki marks. */
export function IconDictionary({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="8" y="6" width="22" height="28" rx="1" {...COMMON_PROPS} />
      <path d="M 28 6 V 34" {...COMMON_PROPS} strokeWidth={STROKE * 0.85} />
      <path d="M 28 10 H 32 M 28 16 H 32 M 28 22 H 32 M 28 28 H 32" {...COMMON_PROPS} strokeWidth={STROKE * 0.5} opacity="0.65" />
      <path d="M 12 13 H 24 M 12 18 H 21 M 12 23 H 24 M 12 28 H 20" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} opacity="0.65" />
    </svg>
  )
}

/** Lightbulb. Chochin paper lantern with horizontal bamboo bands. */
export function IconLightbulb({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M 13 9 Q 13 6 20 6 Q 27 6 27 9 Q 27 26 22 28 H 18 Q 13 26 13 9 Z" {...COMMON_PROPS} />
      <path d="M 13 13 H 27 M 13 18 H 27 M 13 23 H 27" {...COMMON_PROPS} strokeWidth={STROKE * 0.55} opacity="0.65" />
      <line x1="17" y1="32" x2="23" y2="32" {...COMMON_PROPS} />
      <line x1="20" y1="28" x2="20" y2="32" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} />
    </svg>
  )
}

// ── Catalog ──────────────────────────────────────────────────────────────

export interface ChromeMarkEntry {
  name:      string
  component: (props: IconProps) => React.JSX.Element
  reference: string
  group:     'nav' | 'account' | 'status' | 'drawer' | 'topbar' | 'action' | 'edit' | 'data' | 'feedback' | 'progress' | 'lang'
}

export const CHROME_MARKS: ReadonlyArray<ChromeMarkEntry> = [
  // Nav
  { name: 'Dashboard',     component: IconDashboard,     reference: '田 grid with hi-no-maru disc in one cell.',          group: 'nav'      },
  { name: 'Review',        component: IconReview,        reference: 'Card with Tomo top-stripe + tategaki text lines.',   group: 'nav'      },
  { name: 'Decks',         component: IconDecks,         reference: 'Stacked cards with Tomo top-stripe + tategaki.',     group: 'nav'      },
  { name: 'Browse',        component: IconBrowse,        reference: 'Tansu with 3 drawer handles (middle larger).',       group: 'nav'      },
  { name: 'Analytics',     component: IconAnalytics,     reference: 'Sangaku peaks with hi-no-maru sun behind central.', group: 'nav'      },
  // Account menu
  { name: 'Profile',       component: IconProfile,       reference: 'Person with kimono V-collar detail.',                group: 'account'  },
  { name: 'Settings',      component: IconSettings,      reference: 'Butterfly mizuhiki bow knot with center jewel.',     group: 'account'  },
  { name: 'Report a bug',  component: IconReportBug,     reference: 'Speech bubble + tategaki + ku-ten dot.',             group: 'account'  },
  { name: 'Sign out',      component: IconSignOut,       reference: 'Torii with shimenawa rope drape.',                   group: 'account'  },
  // Status
  { name: 'Notifications', component: IconNotifications, reference: 'Fūrin with detailed dome band + tanzaku.',           group: 'status'   },
  { name: 'Offline',       component: IconOffline,       reference: 'Stylized kasumi cloud + horizontal break.',          group: 'status'   },
  { name: 'Search',        component: IconSearch,        reference: 'Magnifier with filled hi-no-maru lens.',             group: 'status'   },
  // Drawer
  { name: 'Hamburger',     component: IconHamburger,     reference: 'Three brush strokes with calligraphic length.',      group: 'drawer'   },
  { name: 'Close',         component: IconClose,         reference: 'X with kanji-stroke weight contrast.',               group: 'drawer'   },
  // Topbar
  { name: 'Help',          component: IconHelp,          reference: 'Question mark with kanji-radical weighting.',        group: 'topbar'   },
  { name: 'Plus',          component: IconPlus,          reference: '十 (juu) kanji with calligraphic terminal.',         group: 'topbar'   },
  // Action
  { name: 'Play',          component: IconPlay,          reference: 'Triangle with kanji-stroke weight + entry dot.',     group: 'action'   },
  { name: 'Pause',         component: IconPause,         reference: 'Two heavier kanji-stroke vertical bars.',            group: 'action'   },
  { name: 'Skip',          component: IconSkip,          reference: 'Two triangles with kanji-stroke weight.',            group: 'action'   },
  { name: 'Reveal',        component: IconReveal,        reference: 'Eye with calligraphic upper lid + filled pupil.',    group: 'action'   },
  { name: 'Hide',          component: IconHide,          reference: 'Closed eye with brush curve + lash marks.',          group: 'action'   },
  // Edit
  { name: 'AddCard',       component: IconAddCard,       reference: 'Card with Tomo top-stripe + kanji-weight +.',        group: 'edit'     },
  { name: 'Edit',          component: IconEdit,          reference: 'Calligraphy brush with bamboo cap detail.',          group: 'edit'     },
  { name: 'Delete',        component: IconDelete,        reference: 'Trash with kanji-stroke X marker inside.',           group: 'edit'     },
  { name: 'Save',          component: IconSave,          reference: 'Bookmark with Tomo top-stripe band.',                group: 'edit'     },
  { name: 'Copy',          component: IconCopy,          reference: 'Two cards with Tomo top-stripe overlapping.',        group: 'edit'     },
  // Data
  { name: 'Tag',           component: IconTag,           reference: 'Omamori (charm) shape with cord knot at top.',       group: 'data'     },
  { name: 'Filter',        component: IconFilter,        reference: 'Funnel with thicker decorated top band.',            group: 'data'     },
  { name: 'Sort',          component: IconSort,          reference: 'Three ofuda strips of decreasing width.',            group: 'data'     },
  { name: 'Calendar',      component: IconCalendar,      reference: 'Calendar with Tomo header band + date dot.',         group: 'data'     },
  { name: 'Clock',         component: IconClock,         reference: 'Kanji-weight hour hand + thin minute hand + ticks.', group: 'data'     },
  // Feedback
  { name: 'Check',         component: IconCheck,         reference: 'Heavier brushstroke check.',                         group: 'feedback' },
  { name: 'Cross',         component: IconCross,         reference: 'Heavier X with kanji-stroke weight contrast.',       group: 'feedback' },
  { name: 'Warning',       component: IconWarning,       reference: 'Triangle with kanji-weight ! + brushstroke dot.',    group: 'feedback' },
  { name: 'Info',          component: IconInfo,          reference: 'Hi-no-maru disc + kanji-stroke i.',                  group: 'feedback' },
  { name: 'More',          component: IconMore,          reference: 'Three brush dots with center slightly larger.',      group: 'feedback' },
  // Progress
  { name: 'Star',          component: IconStar,          reference: 'Five-point star at kanji-stroke weight.',            group: 'progress' },
  { name: 'Flag',          component: IconFlag,          reference: 'Nobori vertical banner with tategaki content.',      group: 'progress' },
  { name: 'Streak',        component: IconStreak,        reference: 'Flame with kanji 火 inner stroke.',                   group: 'progress' },
  { name: 'Trophy',        component: IconTrophy,        reference: 'Rice bowl with curved Asian handles + plinth.',      group: 'progress' },
  { name: 'Target',        component: IconTarget,        reference: 'Hi-no-maru disc + concentric rings + ticks.',        group: 'progress' },
  // Language / Media
  { name: 'Speaker',       component: IconSpeaker,       reference: 'Speaker with calligraphic curve sound waves.',       group: 'lang'     },
  { name: 'Microphone',    component: IconMicrophone,    reference: 'Microphone with kanji-weight capsule.',              group: 'lang'     },
  { name: 'Translate',     component: IconTranslate,     reference: 'Serif A + kana あ + brushstroke arrow.',             group: 'lang'     },
  { name: 'Dictionary',    component: IconDictionary,    reference: 'Wahon book with calligraphic spine + tategaki.',     group: 'lang'     },
  { name: 'Lightbulb',     component: IconLightbulb,     reference: 'Chochin paper lantern with horizontal bands.',       group: 'lang'     },
] as const
