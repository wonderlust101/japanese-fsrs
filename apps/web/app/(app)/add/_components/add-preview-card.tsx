'use client'

import { useMemo } from 'react'

import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const PREVIEW_LINES = [
  'A word, a sentence, a card.',
  'Capture once. Remember many times.',
  'Write the word. Tomo holds it.',
  'Catch it before the day moves on.',
] as const

const DEFAULT_PREVIEW_LINE: string = PREVIEW_LINES[0]

// Pure date-seeded pick, mirroring `today-hero`'s preparation-line technique.
// Same seed → same line for a calendar day.
function pickPreviewLine(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PREVIEW_LINES[hash % PREVIEW_LINES.length] ?? DEFAULT_PREVIEW_LINE
}

// ── Sentence highlight ────────────────────────────────────────────────────────
//
// Render the sentence with case-insensitive substring spans highlighted in
// vermillion. We split into pre/match/post segments without using
// dangerouslySetInnerHTML.

interface SentencePart { kind: 'plain' | 'match'; text: string }

function splitSentenceForTarget(sentence: string, target: string): {
  parts: ReadonlyArray<SentencePart>
  found: boolean
} {
  if (target.length === 0) return { parts: [{ kind: 'plain', text: sentence }], found: false }

  const haystack = sentence.toLowerCase()
  const needle   = target.toLowerCase()
  const idx      = haystack.indexOf(needle)
  if (idx === -1) return { parts: [{ kind: 'plain', text: sentence }], found: false }

  const before = sentence.slice(0, idx)
  const match  = sentence.slice(idx, idx + target.length)
  const after  = sentence.slice(idx + target.length)
  const parts: SentencePart[] = []
  if (before.length > 0) parts.push({ kind: 'plain', text: before })
  parts.push({ kind: 'match', text: match })
  if (after.length > 0)  parts.push({ kind: 'plain', text: after })
  return { parts, found: true }
}

// ── Component ─────────────────────────────────────────────────────────────────

export type CaptureCount = number | null

export interface AddPreviewCardProps {
  /** Trimmed word. Empty string means "no word yet." */
  word:     string
  /** Trimmed sentence. Empty string means "no sentence yet." */
  sentence: string
  /** Date key used to seed the empty-state quote. `yyyy-mm-dd`. */
  todayKey: string
  /** Number captured today, or `null` when unavailable (no listing endpoint
   *  yet — renders as `—`). */
  todayCount:    CaptureCount
  /** Number captured this week, or `null` when unavailable. */
  weekCount:     CaptureCount
  /** Action area rendered at the bottom on `lg+` (Create card + Cancel).
   *  Hidden below `lg`, where the page renders a sticky mobile bar instead. */
  actions:       React.ReactNode
  /** When true, dims the preview surface to telegraph the submitting state. */
  dimmed?:       boolean
}

export function AddPreviewCard({
  word,
  sentence,
  todayKey,
  todayCount,
  weekCount,
  actions,
  dimmed = false,
}: AddPreviewCardProps): React.JSX.Element {
  const emptyQuote = useMemo(() => pickPreviewLine(todayKey), [todayKey])

  const hasWord     = word.length     > 0
  const hasSentence = sentence.length > 0

  const split = useMemo(
    () => splitSentenceForTarget(sentence, word),
    [sentence, word],
  )

  return (
    <SectionCard
      id="add-preview"
      kanji="見"
      label="Card preview"
      stripeTone="brand"
    >
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'transition-opacity duration-200 ease-out',
          dimmed && 'opacity-80',
        )}
      >
        {/* Card silhouette ──────────────────────────────────────────────── */}
        <div
          className={cn(
            'relative rounded-[2px] border border-soft-hairline bg-cream-inset/30',
            'min-h-[180px] px-5 py-6 sm:px-6 sm:py-7',
          )}
        >
          {!hasWord ? (
            // Empty: silhouette + teacher quote.
            <EmptySilhouette quote={emptyQuote} />
          ) : (
            <FilledSilhouette
              word={word}
              sentenceParts={split.parts}
              sentencePresent={hasSentence}
              targetFound={split.found}
            />
          )}
        </div>

        {!hasWord ? null : split.found || !hasSentence ? null : (
          <p className="mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
            Target not found in sentence. Tomo will still try.
          </p>
        )}

        {/* Stat strip ───────────────────────────────────────────────────── */}
        <dl
          className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-soft-hairline/70 pt-5"
          aria-label="Capture activity"
        >
          <StatPair label="Today"     value={formatCount(todayCount)} />
          <StatPair label="This week" value={formatCount(weekCount)} />
        </dl>

        {/* Action area (desktop only — mobile uses the sticky bar) ─────── */}
        <div className="mt-6 hidden lg:block">{actions}</div>
      </div>
    </SectionCard>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptySilhouette({ quote }: { quote: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-stretch gap-4">
      <p className="text-center font-display text-base leading-relaxed text-faded-sumi sm:text-lg">
        “{quote}”
      </p>
      <div className="mx-auto mt-1 flex w-full max-w-[260px] flex-col gap-2.5" aria-hidden="true">
        <span className="block h-px bg-soft-hairline" />
        <span className="block h-px bg-soft-hairline" />
        <span className="block h-px w-2/3 bg-soft-hairline" />
      </div>
    </div>
  )
}

interface FilledSilhouetteProps {
  word:             string
  sentenceParts:    ReadonlyArray<SentencePart>
  sentencePresent:  boolean
  targetFound:      boolean
}

function FilledSilhouette({
  word,
  sentenceParts,
  sentencePresent,
  targetFound,
}: FilledSilhouetteProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p
          lang="ja"
          className="font-japanese font-display text-3xl leading-tight text-sumi-ink"
        >
          {word}
        </p>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
          target
        </span>
      </div>

      <div className="flex items-baseline gap-3 border-t border-soft-hairline/70 pt-3">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
          reading
        </span>
        <span className="font-mono text-sm text-faded-sumi">—</span>
      </div>
      <p className="-mt-3 text-xs text-faded-sumi">Reading after capture.</p>

      <div className="border-t border-soft-hairline/70 pt-4">
        <span className="block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
          sentence
        </span>
        {sentencePresent ? (
          <p
            lang="ja"
            className={cn(
              'mt-2 font-japanese text-base leading-7 text-sumi-ink',
              !targetFound && 'underline decoration-soft-hairline underline-offset-4 decoration-1',
            )}
          >
            {sentenceParts.map((part, i) =>
              part.kind === 'match' ? (
                <span key={i} className="font-medium text-inari-vermillion">
                  {part.text}
                </span>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-7 text-faded-sumi">
            Add a sentence so Tomo can pick the right meaning.
          </p>
        )}
      </div>
    </div>
  )
}

function StatPair({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </dt>
      <dd className="mt-1 font-display text-[1.25rem] leading-none tabular-nums text-sumi-ink">
        {value}
      </dd>
    </div>
  )
}

function formatCount(count: CaptureCount): string {
  if (count === null) return '—'
  return String(count)
}
