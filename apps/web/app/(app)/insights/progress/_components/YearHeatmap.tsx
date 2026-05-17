'use client'

import { useMemo, useState } from 'react'

import type { HeatmapCell } from './progressTypes'

interface YearHeatmapProps {
  cells: ReadonlyArray<HeatmapCell>
}

// Internal "viewBox units" — the SVG scales to fill its container, so
// these are aspect-ratio anchors, not absolute pixels. Tooltip
// positioning is then percentage-based so it tracks cells at any scale.
const CELL = 16
const GAP  = 4
const LEFT_LABEL_W = 36
const TOP_LABEL_H  = 20
const COLS_VISIBLE = 53

const VB_W = LEFT_LABEL_W + COLS_VISIBLE * (CELL + GAP)
const VB_H = TOP_LABEL_H + 7 * (CELL + GAP)

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Vermillion alpha tier classifier. Five tiers from "no reviews" through
 * "heavy day," chosen so a typical practice day (15–30 reviews) lands in
 * the middle of the ramp rather than at the extremes.
 */
function tierClass(count: number): string {
  if (count === 0)   return 'bg-cream-inset border border-soft-hairline/40'
  if (count <= 5)    return 'bg-inari-vermillion-deep/15'
  if (count <= 15)   return 'bg-inari-vermillion-deep/35'
  if (count <= 30)   return 'bg-inari-vermillion-deep/60'
  return                   'bg-inari-vermillion-deep'
}

const LEGEND_TIERS = [
  { label: '0',     cls: 'bg-cream-inset border border-soft-hairline/40' },
  { label: '1–5',   cls: 'bg-inari-vermillion-deep/15' },
  { label: '6–15',  cls: 'bg-inari-vermillion-deep/35' },
  { label: '16–30', cls: 'bg-inari-vermillion-deep/60' },
  { label: '31+',   cls: 'bg-inari-vermillion-deep'    },
]

interface CellPosition {
  cell: HeatmapCell
  col:  number  // 0..52
  row:  number  // 0..6 (Sun..Sat)
}

function gridPositions(cells: ReadonlyArray<HeatmapCell>): CellPosition[] {
  if (cells.length === 0) return []
  const last = cells[cells.length - 1]
  if (last === undefined) return []
  const lastDate = new Date(`${last.date}T00:00:00Z`)
  const lastRow  = lastDate.getUTCDay()
  const out: CellPosition[] = []
  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i]
    if (c === undefined) continue
    const offset = cells.length - 1 - i
    const totalRow = lastRow - offset
    const col = COLS_VISIBLE - 1 + Math.floor(totalRow / 7)
    const row = ((totalRow % 7) + 7) % 7
    if (col < 0) continue
    out.push({ cell: c, col, row })
  }
  return out
}

function monthColumnMarkers(cells: ReadonlyArray<HeatmapCell>): Array<{ col: number; label: string }> {
  const positions = gridPositions(cells)
  const seen = new Map<string, number>()
  for (const p of positions) {
    if (p.row !== 0) continue
    const date = new Date(`${p.cell.date}T00:00:00Z`)
    const month = date.getUTCMonth()
    const key = `${date.getUTCFullYear()}-${month}`
    if (!seen.has(key)) seen.set(key, p.col)
  }
  return Array.from(seen.entries()).map(([key, col]) => {
    const parts = key.split('-')
    const monthNumStr = parts[1] ?? '0'
    const monthIdx = Number(monthNumStr)
    return { col, label: MONTH_LABELS[monthIdx] ?? '' }
  })
}

/**
 * Year heatmap: 53 weeks × 7 days, full-width inside its SectionCard.
 * The SVG uses a viewBox + `preserveAspectRatio` so the grid scales
 * fluidly to whatever width its container provides — at 1440px the
 * cells render ~22px on a side; at narrow viewports they shrink
 * proportionally so the year always fits without horizontal scroll.
 *
 * Deliberate omissions per IA: no streak counter, no "longest streak"
 * badge, no flame icons. Just the grid.
 */
export function YearHeatmap({ cells }: YearHeatmapProps): React.JSX.Element {
  const [hover, setHover] = useState<CellPosition | null>(null)
  const positions = useMemo(() => gridPositions(cells), [cells])
  const months = useMemo(() => monthColumnMarkers(cells), [cells])

  return (
    <div className="flex flex-col gap-y-5">
      <p className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-faded-sumi">
        Cadence <span className="text-sumi-ink/70">·</span>{' '}
        <span className="text-sumi-ink/85">the last 365 days</span>
      </p>

      <div className="relative w-full">
        <svg
          role="img"
          aria-label="Year heatmap of daily reviews"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full"
        >
          {/* Month labels */}
          {months.map((m) => (
            <text
              key={`${m.col}-${m.label}`}
              x={LEFT_LABEL_W + m.col * (CELL + GAP)}
              y={TOP_LABEL_H - 6}
              className="fill-faded-sumi font-mono"
              fontSize="11"
            >
              {m.label}
            </text>
          ))}

          {/* Day-of-week labels (Mon/Wed/Fri) */}
          {[
            { row: 1, label: 'Mon' },
            { row: 3, label: 'Wed' },
            { row: 5, label: 'Fri' },
          ].map((d) => (
            <text
              key={d.label}
              x={0}
              y={TOP_LABEL_H + d.row * (CELL + GAP) + CELL - 3}
              className="fill-faded-sumi font-mono"
              fontSize="11"
            >
              {d.label}
            </text>
          ))}

          {/* Cells */}
          {positions.map((p) => {
            const isHover = hover !== null && hover.cell.date === p.cell.date
            return (
              <foreignObject
                key={p.cell.date}
                x={LEFT_LABEL_W + p.col * (CELL + GAP)}
                y={TOP_LABEL_H + p.row * (CELL + GAP)}
                width={CELL}
                height={CELL}
              >
                <button
                  type="button"
                  aria-label={`${p.cell.date}: ${p.cell.count} reviews`}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(p)}
                  onBlur={() => setHover(null)}
                  className={[
                    'block h-full w-full rounded-[2px] transition-transform duration-150 ease-out',
                    tierClass(p.cell.count),
                    isHover ? 'scale-[1.18] ring-1 ring-sumi-ink/30' : '',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-1',
                  ].join(' ')}
                />
              </foreignObject>
            )
          })}
        </svg>

        {/* Tooltip: percent-positioned so it tracks the cell at any SVG scale.
            Anchor is the cell's center within the viewBox; left/top are
            normalized as `(x / VB_W) * 100%` to ride scale.*/}
        {hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-2.5 py-1.5 text-xs text-sumi-ink shadow-[var(--shadow-card)]"
            style={{
              left: `${((LEFT_LABEL_W + hover.col * (CELL + GAP) + CELL / 2) / VB_W) * 100}%`,
              top:  `${((TOP_LABEL_H + hover.row * (CELL + GAP) - 6) / VB_H) * 100}%`,
            }}
          >
            <div className="font-mono text-[0.6875rem] text-faded-sumi">
              {new Date(`${hover.cell.date}T00:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'short',
                month:   'short',
                day:     'numeric',
                year:    'numeric',
              })}
            </div>
            <div className="mt-0.5 tabular-nums">
              {hover.cell.count === 0
                ? 'No reviews'
                : `${hover.cell.count} review${hover.cell.count === 1 ? '' : 's'}`}
              {hover.cell.count > 0 && (
                <span className="ml-2 text-faded-sumi">
                  {Math.round(hover.cell.retention * 100)}% retention
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-x-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        <span>Less</span>
        <ul className="flex items-center gap-x-1">
          {LEGEND_TIERS.map((t) => (
            <li
              key={t.label}
              title={`${t.label} reviews`}
              className={['inline-block h-3 w-3 rounded-[2px]', t.cls].join(' ')}
              aria-label={`${t.label} reviews`}
            />
          ))}
        </ul>
        <span>More</span>
      </div>
    </div>
  )
}
