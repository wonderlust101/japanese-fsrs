'use client'

import { cn } from '@/lib/utils'

// Mora-level pitch accent graph (v4). Hovers above the kanji block as a
// tonal staff. Each mora cell shows the high/low/drop state with a top line
// over high morae and a small downstep tick after the drop. Cells are sized
// generously (~28-40px wide) so the staff is legible from a desk reviewer's
// natural distance.
//
// Data path:
// - `pitchPosition` is the numeric pitch accent (0 = heiban, 1 = atamadaka,
//   k = drop after the k-th mora). When null, the graph hides.
// - The graph aligns mora cells under each character of the *reading*, not
//   the kanji. The whole staff is positioned by the parent (WordStack)
//   centered above the kanji block.

export type PitchCategory = 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka'

const SMALL_KANA = new Set('ァィゥェォャュョヮぁぃぅぇぉゃゅょゎ゙゚°')

function groupMoras(kana: string): string[] {
  const out: string[] = []
  for (let i = 0; i < kana.length; i += 1) {
    const cur  = kana[i]
    const next = kana[i + 1]
    if (cur !== undefined && next !== undefined && SMALL_KANA.has(next)) {
      out.push(cur + next)
      i += 1
    } else if (cur !== undefined) {
      out.push(cur)
    }
  }
  return out
}

function classify(position: number, moraCount: number): PitchCategory {
  if (position === 0)                        return 'heiban'
  if (position === 1)                        return 'atamadaka'
  if (position === moraCount)                return 'odaka'
  return 'nakadaka'
}

interface MoraPitch {
  text:  string
  state: 'low' | 'high' | 'drop'
}

function computePitches(morae: string[], position: number): MoraPitch[] {
  return morae.map((text, i) => {
    let state: MoraPitch['state'] = 'low'
    if (position <= 0) {
      state = i === 0 ? 'low' : 'high'
    } else if (position === 1) {
      state = i === 0 ? 'drop' : 'low'
    } else {
      if (i === position - 1)      state = 'drop'
      else if (i === 0 || i >= position) state = 'low'
      else                          state = 'high'
    }
    return { text, state }
  })
}

const CATEGORY_LABEL: Record<PitchCategory, string> = {
  heiban:    'heiban',
  atamadaka: 'atamadaka',
  nakadaka:  'nakadaka',
  odaka:     'odaka',
}

// Use the dedicated v4.1 pitch tokens. These read distinctly across the four
// categories but stay calm against warm-paper surfaces.
const CATEGORY_COLOR: Record<PitchCategory, string> = {
  heiban:    'text-pitch-heiban',
  atamadaka: 'text-pitch-atamadaka',
  nakadaka:  'text-pitch-nakadaka',
  odaka:     'text-pitch-odaka',
}

interface PitchGraphProps {
  reading:       string | null | undefined
  pitchPosition: number | null | undefined
  onCategoryChange?: (category: PitchCategory | null) => void
}

// Renders nothing when there's no pitch data. Reading-only fallback is left
// to the parent so the WordStack can decide whether to show the reading
// inline beneath the kanji when the staff is absent.

export function PitchGraph({
  reading,
  pitchPosition,
  onCategoryChange,
}: PitchGraphProps): React.JSX.Element | null {
  if (reading === null || reading === undefined || reading === '') {
    onCategoryChange?.(null)
    return null
  }
  if (pitchPosition === null || pitchPosition === undefined) {
    onCategoryChange?.(null)
    return null
  }

  const morae = groupMoras(reading)
  if (morae.length === 0) return null
  const category = classify(pitchPosition, morae.length)
  const pitches  = computePitches(morae, pitchPosition)
  onCategoryChange?.(category)

  return (
    <div
      role="img"
      aria-label={`Pitch accent ${CATEGORY_LABEL[category]} ${pitchPosition}`}
      className={cn(
        'inline-flex flex-col items-center gap-2 select-none',
        CATEGORY_COLOR[category],
      )}
    >
      <div className="inline-flex items-end">
        {pitches.map((m, i) => {
          const isHigh = m.state === 'high' || m.state === 'drop'
          const isDrop = m.state === 'drop'
          return (
            <span
              key={i}
              className="relative inline-flex flex-col items-center"
              style={{ minWidth: '1.85em' }}
            >
              {/* Top line over high morae */}
              <span
                aria-hidden="true"
                className={cn(
                  'block w-full h-0.5 rounded-full',
                  isHigh ? 'bg-current opacity-90' : 'opacity-0',
                )}
              />
              {/* Drop tick on the right edge of the drop mora */}
              {isDrop && (
                <span
                  aria-hidden="true"
                  className="absolute right-[-1px] top-0 block h-2 w-[2px] bg-current rounded-full"
                />
              )}
              {/* Mora kana */}
              <span
                lang="ja"
                className="pt-1.5 font-japanese text-md md:text-lg text-sumi-ink/85 leading-none tabular-nums"
              >
                {m.text}
              </span>
            </span>
          )
        })}
      </div>
      <span className="font-mono text-sm text-current/80">
        {CATEGORY_LABEL[category]} · {pitchPosition}
      </span>
    </div>
  )
}
