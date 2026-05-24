'use client'

import { useEffect, useState } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   TomoLoader

   A card-stack loader that replaces all skeleton/animate-pulse usage.
   One motif (a card draws from a small stack, holds, returns), three
   sizes (inline / block / page), one optional long-wait variant with
   rotating stage labels.

   Visual identity:
     - sumi-ink hairlines on warm-paper card faces
     - vermillion is reserved for the *lead* card's inner stroke only
     - no shimmer, no pulse, no gradient
     - all motion is transform/opacity; layout properties are never animated

   Accessibility:
     - the loader itself carries aria-label="Loading"
     - long-wait stage labels live in an aria-live="polite" region
     - prefers-reduced-motion collapses the draw motion to a slow breath
   ────────────────────────────────────────────────────────────────────── */

type Size = 'inline' | 'block' | 'page'

interface TomoLoaderProps {
  /** Visual size. inline = 16px (in-row), block = 64px (section), page = 140px (full route). */
  size?:        Size
  /**
   * Optional rotating status copy for long AI waits. When provided and `size === 'page'`,
   * the loader renders the active label beneath the cards with a polite live region.
   * Strings cycle every 1.8s; the last one persists once reached.
   */
  stageLabels?: readonly string[]
  /**
   * Secondary line shown when the wait exceeds {@link slowAfterMs}.
   * Defaults to a quiet reassurance string; pass `null` to suppress.
   */
  slowLabel?:   string | null
  /** ms after mount before {@link slowLabel} appears. Default 8000. */
  slowAfterMs?: number
  /** Optional className applied to the outer wrapper. */
  className?:   string
}

const SLOW_DEFAULT_LABEL = 'Taking longer than usual. Still working.'
const STAGE_INTERVAL_MS  = 1800
/* Page-size centerpiece cadence. Kept well under the loader's typical visible
   lifetime so the glyph visibly changes during an ordinary route load (the
   previous 1600ms outlived most loads, leaving the kanji apparently frozen). */
const KANJI_CYCLE_MS     = 700
/* Curated pool of common, well-supported kanji for the page-size centerpiece.
   A random glyph is shown on each cycle. The pool is hand-picked (rather than
   sampling arbitrary codepoints) so every frame renders cleanly in the CJK
   font stack — random Unicode in the kanji range often lands on glyphs the
   font can't draw. Leans on calm, evocative characters that fit Tomo's tone. */
const KANJI_POOL = [
  '学', '語', '道', '心', '力', '水', '火', '木', '金', '土',
  '日', '月', '花', '鳥', '風', '山', '川', '海', '空', '雨',
  '雪', '星', '光', '夢', '知', '思', '見', '聞', '書', '読',
  '話', '待', '友', '和', '森', '林', '雲', '春', '秋', '音',
] as const

export function TomoLoader({
  size        = 'block',
  stageLabels,
  slowLabel   = SLOW_DEFAULT_LABEL,
  slowAfterMs = 8000,
  className   = '',
}: TomoLoaderProps): React.JSX.Element {
  const showStage = size === 'page' && stageLabels && stageLabels.length > 0

  return (
    <div
      role="status"
      aria-label="Loading"
      aria-live={showStage ? 'polite' : undefined}
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <CardStack size={size} />
      {size === 'page' ? (
        <PageCenterKana />
      ) : null}
      {showStage ? (
        <StageLabels labels={stageLabels} slowLabel={slowLabel} slowAfterMs={slowAfterMs} />
      ) : null}
    </div>
  )
}

/* ── Card stack SVG ────────────────────────────────────────────────── */

interface CardStackProps { size: Size }

function CardStack({ size }: CardStackProps): React.JSX.Element {
  const { width, height, cards, radius, offset } = DIMENSIONS[size]
  /* Compose a small stack: a base shadow card, two background cards,
     then the lead card that draws upward. Lead is drawn last so it
     paints on top during the lift. */
  const restCount = Math.max(0, cards - 1)
  /* The lead card draws up by translateY(-46%) of its own height
     (height * 0.78). Reserve that lift (plus margin for the warm
     drop-shadow) as room above the stack so the lifted card and its
     vermillion stripe are never clipped. The same room is mirrored below
     so the resting stack sits at the optical center of the viewBox (and
     therefore at the center of the page once the flex container centers
     the svg), rather than being shoved downward by top-only padding. */
  const lift  = Math.ceil(height * 0.78 * 0.46 + 6)
  const shift = lift - height * 0.18
  const vbH   = height + lift + shift
  const top   = lift
  return (
    <svg
      width={width}
      height={vbH}
      viewBox={`0 0 ${width} ${vbH}`}
      aria-hidden="true"
      className="overflow-visible motion-reduce:[&_.tomo-lead-card]:!animate-[var(--animate-tomo-card-breath)]"
    >
      {/* background cards: stacked with vertical offset so the stack has weight */}
      {Array.from({ length: restCount }).map((_, i) => {
        const idx       = restCount - i
        const cardW     = width  - idx * offset * 2
        const cardH     = height - idx * offset * 2 - height * 0.18
        const x         = (width  - cardW) / 2
        const y         = height - cardH - idx * offset + shift
        const opacity   = 0.32 + (restCount - idx) * 0.18
        return (
          <rect
            key={idx}
            x={x}
            y={y}
            width={cardW}
            height={cardH}
            rx={radius}
            className="tomo-card"
            style={{ opacity }}
          />
        )
      })}

      {/* secondary card (top of the deck, brightens on each draw) */}
      <rect
        x={offset}
        y={top}
        width={width - offset * 2}
        height={height * 0.78}
        rx={radius}
        className="tomo-card motion-reduce:!animate-none"
        style={{ animation: 'var(--animate-tomo-card-reveal)', transformOrigin: 'center' }}
      />

      {/* lead card: drawn upward each loop. Carries the canonical Tomo card
         anatomy — a 2px Inari Vermillion top-edge stripe inset between the
         rounded corners — so the drawn card reads as a real card, not a
         blank rectangle. The stripe rides inside the lead <g>, so it lifts
         with the card. */}
      <g
        className="tomo-lead-card motion-reduce:!animate-[var(--animate-tomo-card-breath)]"
        style={{
          animation:       'var(--animate-tomo-card-draw)',
          transformOrigin: `${width / 2}px ${height + shift}px`,
        }}
      >
        <rect
          x={offset}
          y={top}
          width={width - offset * 2}
          height={height * 0.78}
          rx={radius}
          className="tomo-card-lead"
        />
        <rect
          x={offset + radius}
          y={top + Math.max(1, radius * 0.35)}
          width={Math.max(0, width - offset * 2 - radius * 2)}
          height={Math.max(2, height * 0.018)}
          rx={Math.min(1, radius / 2)}
          className="tomo-card-stripe"
        />
      </g>
    </svg>
  )
}

/* ── Page-size centerpiece: a random kanji, swapped each cycle ──────── */

function randomKanjiIndex(exclude: number): number {
  // Pick a fresh index, never repeating the current one so consecutive frames
  // always visibly differ (a repeat would read as a stall).
  if (KANJI_POOL.length <= 1) return 0
  let next = Math.floor(Math.random() * KANJI_POOL.length)
  if (next === exclude) next = (next + 1) % KANJI_POOL.length
  return next
}

function PageCenterKana(): React.JSX.Element {
  // Deterministic first paint (index 0) so SSR and the client agree; the glyph
  // is randomized on mount and on every cycle thereafter.
  const [idx, setIdx] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    // Randomize the first shown glyph after mount (avoids always opening on the
    // same pool[0] character). Under reduced motion this single swap is the
    // whole animation; no interval runs.
    setIdx((i) => randomKanjiIndex(i))
    if (reduced) return
    const t = window.setInterval(() => {
      setIdx((i) => randomKanjiIndex(i))
    }, KANJI_CYCLE_MS)
    return () => window.clearInterval(t)
  }, [reduced])

  return (
    <div
      lang="ja"
      aria-hidden="true"
      className="text-faded-sumi/70 -mt-2 text-2xl tracking-[0.04em]"
    >
      {KANJI_POOL[idx]}
    </div>
  )
}

/* ── Stage labels for long AI waits ────────────────────────────────── */

interface StageLabelsProps {
  labels:      readonly string[]
  slowLabel:   string | null
  slowAfterMs: number
}

function StageLabels({ labels, slowLabel, slowAfterMs }: StageLabelsProps): React.JSX.Element {
  const [idx, setIdx]   = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (labels.length <= 1) return
    const t = window.setInterval(() => {
      setIdx((i) => Math.min(i + 1, labels.length - 1))
    }, STAGE_INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [labels.length])

  useEffect(() => {
    if (!slowLabel || slowAfterMs <= 0) return
    const t = window.setTimeout(() => setSlow(true), slowAfterMs)
    return () => window.clearTimeout(t)
  }, [slowLabel, slowAfterMs])

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        key={idx}
        className="text-faded-sumi text-sm"
        style={{ animation: 'var(--animate-tomo-stage-fade)' }}
      >
        {labels[idx]}
      </div>
      {slow && slowLabel ? (
        <div className="text-faded-sumi/70 text-xs">{slowLabel}</div>
      ) : null}
    </div>
  )
}

/* ── Size table ────────────────────────────────────────────────────── */

interface SizeDims {
  width:  number
  height: number
  /** number of cards including the lead */
  cards:  number
  /** corner radius */
  radius: number
  /** per-card stack offset */
  offset: number
}

const DIMENSIONS: Record<Size, SizeDims> = {
  inline: { width: 16,  height: 18,  cards: 2, radius: 2,  offset: 1 },
  block:  { width: 56,  height: 70,  cards: 3, radius: 4,  offset: 2 },
  page:   { width: 110, height: 138, cards: 4, radius: 6,  offset: 3 },
}

/* ──────────────────────────────────────────────────────────────────────
   PageLoader

   Centered page-size TomoLoader sized to fill an app route's content
   area. Use as the return value when a route is still gathering its
   primary data:

     if (isLoading) return <PageLoader />

   For uses that need rotating AI stage labels, pass `stageLabels`.
   ────────────────────────────────────────────────────────────────────── */

interface PageLoaderProps {
  stageLabels?: readonly string[]
  className?:   string
}

export function PageLoader({
  stageLabels,
  className = '',
}: PageLoaderProps): React.JSX.Element {
  return (
    <div
      className={`flex min-h-[60vh] flex-1 items-center justify-center px-6 ${className}`}
    >
      {stageLabels !== undefined
        ? <TomoLoader size="page" stageLabels={stageLabels} />
        : <TomoLoader size="page" />}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   PageGate

   Wait-then-reveal wrapper for app routes. Holds the content area on a
   centered page-size TomoLoader until `ready` becomes true, then swaps
   to children instantly (no fade, per design decision).

   Wrap this around the return value of a route's top-level client
   component. Pass `ready` as the conjunction of every critical query's
   resolved state, e.g.:

     const decks    = useDecks()
     const due      = useDueCards()
     const forecast = useReviewForecast()

     return (
       <PageGate ready={!decks.isPending && !due.isPending && !forecast.isPending}>
         {... real content ...}
       </PageGate>
     )

   Once `ready` flips true, the gate latches open: even if a query later
   re-enters `isPending` (e.g. background refetch), the page stays
   visible. This avoids the page disappearing on every refetch.

   The gate intentionally does NOT add a mount-delay. The brief calls for
   wait-then-reveal: the loader is the first paint of every route.
   ────────────────────────────────────────────────────────────────────── */

interface PageGateProps {
  ready:        boolean
  /** Optional stage labels for long AI waits. Forwarded to the loader. */
  stageLabels?: readonly string[]
  /** Optional className applied to the loader wrapper while gating. */
  loaderClassName?: string
  children:     React.ReactNode
}

export function PageGate({
  ready,
  stageLabels,
  loaderClassName = '',
  children,
}: PageGateProps): React.JSX.Element {
  const [opened, setOpened] = useState(ready)

  useEffect(() => {
    if (ready && !opened) setOpened(true)
  }, [ready, opened])

  if (opened) return <>{children}</>

  return (
    <div
      className={`flex min-h-[60vh] flex-1 items-center justify-center px-6 ${loaderClassName}`}
    >
      {stageLabels !== undefined
        ? <TomoLoader size="page" stageLabels={stageLabels} />
        : <TomoLoader size="page" />}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   useDelayedLoading

   Avoids the two classic loader bugs:
     - flash on cache hits (loader shows for 80ms then disappears)
     - flicker (loader appears, data resolves immediately, loader unmounts
       before the user can perceive what happened)

   Parents pass their own `isLoading`; this returns a gated boolean.
   Mount-delay: 200ms before the loader becomes visible.
   Min-duration: once visible, the loader stays for at least 400ms.
   ────────────────────────────────────────────────────────────────────── */

export function useDelayedLoading(
  isLoading:   boolean,
  delayMs    = 200,
  minVisible = 400,
): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      // already hidden, nothing to do
      if (!visible) return
      return
    }

    const showT = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(showT)
  }, [isLoading, delayMs, visible])

  useEffect(() => {
    if (!visible) return
    if (isLoading) return
    const hideT = window.setTimeout(() => setVisible(false), minVisible)
    return () => window.clearTimeout(hideT)
  }, [visible, isLoading, minVisible])

  return visible
}
