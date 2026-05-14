'use client'

import type { StubCadenceDay } from './profile-stub-data'

export type CadenceVariant = 'bands' | 'stripe' | 'constellation'

export const CADENCE_VARIANTS: readonly CadenceVariant[] = [
  'bands', 'stripe', 'constellation',
]

export const CADENCE_META: Record<CadenceVariant, { short: string; label: string; blurb: string }> = {
  bands:         { short: 'C2', label: 'Month bands',   blurb: '12 horizontal stripes, one per month.' },
  stripe:        { short: 'C3', label: 'Stripe',        blurb: '2 months desktop / 1 month mobile. Taller, more contrast.' },
  constellation: { short: 'C4', label: 'Constellation', blurb: 'Sumi-e sparse dots. Most painterly.' },
}

interface CadenceProps {
  variant: CadenceVariant
  cadence: StubCadenceDay[]
}

export function CadenceSection({ variant, cadence }: CadenceProps): React.JSX.Element {
  const practiced = cadence.filter((d) => d.intensity > 0).length

  switch (variant) {
    case 'bands':         return <CadenceBands         cadence={cadence} practiced={practiced} />
    case 'stripe':        return <CadenceStripe        cadence={cadence} practiced={practiced} />
    case 'constellation': return <CadenceConstellation cadence={cadence} practiced={practiced} />
  }
}

/** Vermillion-tinted intensity ramp shared by the grid-based variants. */
function intensityClass(level: 0 | 1 | 2 | 3): string {
  if (level === 0) return 'bg-cool-paper-shade'
  if (level === 1) return 'bg-vermillion-wash'
  if (level === 2) return 'bg-inari-vermillion/55'
  return 'bg-inari-vermillion'
}

/** Punchier intensity ramp used by the Stripe variant, which needs more
 *  contrast because it carries fewer days at larger size. */
function stripeIntensityClass(level: 0 | 1 | 2 | 3): string {
  if (level === 0) return 'bg-cool-paper-shade'
  if (level === 1) return 'bg-inari-vermillion/25'
  if (level === 2) return 'bg-inari-vermillion/65'
  return 'bg-inari-vermillion'
}

interface InnerProps {
  cadence:   StubCadenceDay[]
  practiced: number
}

function CadenceHeading({ practiced }: { practiced: number }): React.JSX.Element {
  return (
    <p className="text-sm text-sumi-ink">
      <span className="font-mono tabular-nums">{practiced}</span>
      <span className="text-faded-sumi"> days of practice this past year</span>
    </p>
  )
}

/** C2 — Month bands. 12 rows of ~30 cells, label to the left. Splits the
 *  365-day array into 12 even chunks (sketch fidelity, not strict calendar). */
function CadenceBands({ cadence, practiced }: InnerProps): React.JSX.Element {
  const months = ['JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY']
  const chunkSize = Math.ceil(cadence.length / 12)

  return (
    <div>
      <CadenceHeading practiced={practiced} />
      <div aria-hidden="true" className="mt-4 space-y-1.5">
        {months.map((m, idx) => {
          const slice = cadence.slice(idx * chunkSize, (idx + 1) * chunkSize)
          return (
            <div key={m} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">{m}</span>
              <div className="flex gap-[3px]">
                {slice.map((d, i) => (
                  <span
                    key={`${m}-${i}`}
                    className={`h-2.5 flex-1 rounded-[1px] ${intensityClass(d.intensity)}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** C3 — Stripe. Substantial horizontal blocks. Responsive: 30 days
 *  (≈ 1 month) on mobile, 60 days (≈ 2 months) on desktop. Taller cells
 *  and a punchier intensity ramp than the multi-row variants so the
 *  stripe reads as the centerpiece rather than as a quiet aside. */
function CadenceStripe({ cadence, practiced }: InnerProps): React.JSX.Element {
  const last60 = cadence.slice(-60)
  const last30 = cadence.slice(-30)

  return (
    <div>
      <CadenceHeading practiced={practiced} />
      {/* Mobile: 30 days (~1 month) */}
      <div aria-hidden="true" className="mt-5 flex h-8 gap-1 sm:hidden">
        {last30.map((d, i) => (
          <span
            key={`m${i}`}
            className={`flex-1 rounded-[2px] ${stripeIntensityClass(d.intensity)}`}
          />
        ))}
      </div>
      {/* Desktop: 60 days (~2 months) */}
      <div aria-hidden="true" className="mt-5 hidden h-9 gap-1 sm:flex">
        {last60.map((d, i) => (
          <span
            key={`d${i}`}
            className={`flex-1 rounded-[2px] ${stripeIntensityClass(d.intensity)}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex justify-between font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span className="sm:hidden">1 month ago</span>
        <span className="hidden sm:inline">2 months ago</span>
        <span>today</span>
      </div>
    </div>
  )
}

/** C4 — Constellation. Days as dots scattered along a single axis. Only
 *  practiced days render (empty days are invisible). Different intensities
 *  produce different dot sizes; the result is sumi-e sparse. */
function CadenceConstellation({ cadence, practiced }: InnerProps): React.JSX.Element {
  return (
    <div>
      <CadenceHeading practiced={practiced} />
      <div
        aria-hidden="true"
        className="mt-4 relative h-16 w-full overflow-hidden"
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-soft-hairline" />
        {cadence.map((d, i) => {
          if (d.intensity === 0) return null
          const x = (i / (cadence.length - 1)) * 100
          const wobble = (Math.sin(i * 7.31) * 0.5 + 0.5) * 28
          const y = 32 - 14 + wobble
          const size = d.intensity === 1 ? 3 : d.intensity === 2 ? 4 : 6
          const opacity = d.intensity === 1 ? 0.4 : d.intensity === 2 ? 0.7 : 1
          return (
            <span
              key={d.daysAgo}
              className="absolute rounded-full bg-inari-vermillion"
              style={{
                left:    `calc(${x}% - ${size / 2}px)`,
                top:     `${y}px`,
                width:   `${size}px`,
                height:  `${size}px`,
                opacity,
              }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span>a year ago</span>
        <span>today</span>
      </div>
    </div>
  )
}
