import { State, type ApiCard } from '@fsrs-japanese/shared-types'

import { cn } from '@/lib/utils'

interface Props { card: ApiCard }

// The scheduler runs at request_retention = 0.85 (apps/api fsrs.service.ts),
// so 0.85 is the recall floor the curve decays toward before the next review.
const RETENTION_TARGET = 0.85

// FSRS power forgetting curve: R(t) = 1 / (1 + t / (9·S)). At t = S, R ≈ 0.9.
function retrievability(t: number, stability: number): number {
  const s = Math.max(stability, 0.01)
  return 1 / (1 + t / (9 * s))
}

function stateLabel(state: State): string {
  switch (state) {
    case State.New:        return 'New'
    case State.Learning:   return 'Learning'
    case State.Relearning: return 'Relearning'
    case State.Review:     return 'Review'
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}

function formatSpan(days: number): string {
  if (days < 1)   return 'under a day'
  if (days < 45)  return `${Math.round(days)} days`
  if (days < 365) return `${Math.round(days / 30)} months`
  return `${(days / 365).toFixed(1)} years`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The card's scheduling state shown as the FSRS forgetting curve: recall
 * decaying from the last review toward the 0.85 retention floor, with "today"
 * and "next review" marked on the curve. New / never-studied cards show a
 * quiet placeholder instead of a meaningless curve. Chrome-less by design —
 * the parent wraps this in a SectionCard.
 */
export function CardHistoryPanel({ card }: Props): React.JSX.Element {
  const isNew = card.state === State.New || card.reps === 0 || card.lastReview === null

  if (isNew) {
    return (
      <div className="flex flex-col gap-4">
        <p className="max-w-measure-tight text-sm leading-relaxed text-faded-sumi">
          Not studied yet. The memory curve appears here after the first
          review, once Tomo has something to schedule.
        </p>
        <dl>
          <StatCell label="State" value={stateLabel(card.state)} />
        </dl>
      </div>
    )
  }

  // ── Geometry. A wide viewBox the SVG scales to fill the popup width. ──
  const VB_W = 760
  const VB_H = 232
  const L = 46, R = 716, T = 26, B = 176           // plot box edges
  const BASE = B                                    // y for r = yFloor

  const stability = Math.max(card.stability, 0.01)
  const elapsed   = Math.max(card.elapsedDays, 0)
  const sched     = Math.max(card.scheduledDays, 0.5)
  const rNow      = retrievability(elapsed, stability)
  const pctNow    = Math.round(rNow * 100)
  const overdue   = elapsed > sched

  // Run a little past whichever of now / due / stability is furthest out.
  const tMax = Math.max(sched, elapsed, stability) * 1.45

  // Cards live in the 85–100% band, so map a tight retention window (a hair
  // below the lowest plotted value, up to 100%) instead of 0–100%. This lets
  // the actual decay fill the chart's height rather than hugging the top.
  const yTop   = 1
  const yFloor = Math.max(0.5, Math.min(retrievability(tMax, stability), RETENTION_TARGET, rNow) - 0.04)

  const xOf = (t: number): number => L + (Math.min(t, tMax) / tMax) * (R - L)
  const yOf = (r: number): number => {
    const c = Math.max(yFloor, Math.min(yTop, r))
    return T + ((yTop - c) / (yTop - yFloor)) * (B - T)
  }

  const STEPS = 60
  const curve: string = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = (i / STEPS) * tMax
    return `${i === 0 ? 'M' : 'L'} ${xOf(t).toFixed(1)} ${yOf(retrievability(t, stability)).toFixed(1)}`
  }).join(' ')

  // Sumi wash under the curve up to today: "memory spent so far".
  const ASTEPS = 44
  const elapsedClamped = Math.min(elapsed, tMax)
  const areaTop = Array.from({ length: ASTEPS + 1 }, (_, i) => {
    const t = (i / ASTEPS) * elapsedClamped
    return `L ${xOf(t).toFixed(1)} ${yOf(retrievability(t, stability)).toFixed(1)}`
  }).join(' ')
  const area = `M ${xOf(0).toFixed(1)} ${BASE} ${areaTop} L ${xOf(elapsedClamped).toFixed(1)} ${BASE} Z`

  const guideY    = yOf(RETENTION_TARGET)
  const todayX    = xOf(elapsed)
  const todayY    = yOf(rNow)
  const dueX      = xOf(sched)
  const dueY      = yOf(retrievability(sched, stability))

  // Keep the today / due axis labels from colliding when the two markers
  // sit close together (short interval): anchor each away from the other.
  const labelGap = Math.abs(dueX - todayX) < 70
  // When the due marker lands in the rightmost band, its date label would
  // collide with the right-anchored "85% target" label; suppress the latter
  // (the dashed guide stays self-evident). Independent of viewport since the
  // SVG scales uniformly, so this only triggers on genuinely late schedules.
  const dueNearRight = dueX > L + 0.78 * (R - L)
  // When the card was reviewed today, the "today" dot sits on the last-review
  // origin and fully covers its tick; only draw the tick once it clears.
  const lastTickClear = todayX - xOf(0) > 9

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
        Recall fades after each review. You{'’'}d remember this about{' '}
        <span className={cn('font-medium', overdue ? 'text-inari-vermillion-deep' : 'text-sumi-ink')}>
          {pctNow}%
        </span>{' '}
        of the time right now; Tomo brings it back before recall drops past the
        85% target.
      </p>

      {/* ── The forgetting curve, full popup width ─────────────────────── */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        role="img"
        aria-label={`Memory curve: about ${pctNow} percent recall today, next review ${formatDate(card.due)}.`}
      >
        {/* 0.85 retention target guide */}
        <line
          x1={L} y1={guideY} x2={R} y2={guideY}
          className="text-faded-sumi/40" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4"
        />

        {/* sumi wash: memory elapsed since the last review */}
        <path d={area} className="text-sumi-ink" fill="currentColor" fillOpacity={0.05} />

        {/* the curve, inked in on open */}
        <path
          d={curve}
          pathLength={1}
          className="text-sumi-ink animate-memory-curve-draw"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ strokeDasharray: 1 }}
        />

        {/* markers + axis labels fade in just behind the stroke */}
        <g className="animate-memory-fade-in" style={{ animationDelay: '700ms' }}>
          {/* last-review tick (hidden when the today dot covers it) */}
          {lastTickClear && (
            <circle cx={xOf(0)} cy={yOf(1)} r={3} className="text-faded-sumi" fill="currentColor" />
          )}
          {/* next review: hollow ring */}
          <circle cx={dueX} cy={dueY} r={5} className="text-inari-vermillion-deep" fill="var(--color-warm-paper-raised)" stroke="currentColor" strokeWidth="2" />
          {/* today: filled, labelled with the live recall % */}
          <circle cx={todayX} cy={todayY} r={5.5} className="text-inari-vermillion-deep" fill="currentColor" />
          <text x={todayX} y={todayY - 11} textAnchor="middle" className="text-inari-vermillion-deep" fill="currentColor" style={{ fontSize: 12, fontWeight: 600 }}>
            {pctNow}%
          </text>

          {/* axis labels */}
          <text x={xOf(0)} y={BASE + 20} textAnchor="start" className="text-faded-sumi" fill="currentColor" style={{ fontSize: 11 }}>
            {formatDate(card.lastReview as string)}
          </text>
          <text x={dueX} y={BASE + 20} textAnchor={labelGap ? 'end' : 'middle'} className="text-faded-sumi" fill="currentColor" style={{ fontSize: 11 }}>
            due {formatDate(card.due)}
          </text>

          {/* 85% target label, dropped to the axis row so it reads cleanly
              without colliding with the curve. Hidden when the due label
              would overlap it at the right edge. */}
          {!dueNearRight && (
            <text x={R} y={BASE + 20} textAnchor="end" className="text-faded-sumi" fill="currentColor" style={{ fontSize: 11 }}>
              85% target
            </text>
          )}
        </g>
      </svg>

      {/* ── Plain-language scheduling readout, as a stat strip ─────────── */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-soft-hairline pt-5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCell label="State" value={stateLabel(card.state)} />
        <StatCell label="Memory holds" value={`~${formatSpan(stability)}`} />
        <EaseCell difficulty={card.difficulty} />
        <StatCell label="Reviews" value={String(card.reps)} />
        <StatCell label="Lapses" value={String(card.lapses)} emphasize={card.lapses >= 3} />
        {card.isSuspended && <StatCell label="Status" value="Suspended" emphasize />}
      </dl>
    </div>
  )
}

function StatCell({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-sm uppercase tracking-[0.1em] text-faded-sumi">{label}</dt>
      <dd className={cn(
        'font-mono text-base tabular-nums leading-none',
        emphasize === true ? 'font-semibold text-inari-vermillion-deep' : 'text-sumi-ink',
      )}>
        {value}
      </dd>
    </div>
  )
}

// FSRS difficulty (0–10, higher = harder) shown as its inverse, "ease", so a
// fuller bar reads as the intuitive "good" direction. The /10 anchor makes the
// number interpretable; the fill stays neutral (no warning color, color-blind
// safe).
function EaseCell({ difficulty }: { difficulty: number }): React.JSX.Element {
  const ease = Math.max(0, Math.min(10, 10 - difficulty))
  const pct  = (ease / 10) * 100
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-sm uppercase tracking-[0.1em] text-faded-sumi">Ease</dt>
      <dd className="flex items-center gap-2">
        <span className="whitespace-nowrap font-mono text-base tabular-nums leading-none text-sumi-ink">
          {ease.toFixed(1)} <span className="text-faded-sumi">/ 10</span>
        </span>
        <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-inset">
          <span className="block h-full rounded-full bg-faded-sumi/70" style={{ width: `${pct}%` }} />
        </span>
      </dd>
    </div>
  )
}
