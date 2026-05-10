import Link from 'next/link'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'

import { CardHeader, DATA_CARD_CHROME, ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

const LEECHES_CHROME = `${DATA_CARD_CHROME} h-full`

export interface Leech {
  cardId:   string
  word:     string
  reading:  string
  errors:   number
}

interface LeechesProps {
  state:    ModuleState
  leeches?: Leech[]
}

export function Leeches({ state, leeches = [] }: LeechesProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
        <CardHeader kanji="弱点" label="Leeches forming" rightContent={<SkeletonBlock width={64} height={11} />} />
        <ul className="-mx-2 sm:-mx-3 divide-y divide-soft-hairline/60">
          {[...Array(3)].map((_, i) => (
            <li key={i} className="px-2 sm:px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock width="50%" height={16} />
                <SkeletonBlock width={64} height={13} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
        <CardHeader kanji="弱点" label="Leeches forming" />
        <ModuleError message="Couldn't load leeches." />
      </section>
    )
  }

  if (leeches.length === 0) {
    return (
      <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
        <CardHeader kanji="弱点" label="Leeches forming" />
        <p className="text-sm text-faded-sumi italic max-w-md leading-relaxed">
          No leeches forming. Your cards are settling well.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="leeches-label" className={LEECHES_CHROME}>
      <CardHeader
        kanji="弱点"
        label="Leeches forming"
        count={leeches.length}
        rightContent={
          <Link
            href="/review?mode=drill"
            className="hover:text-sumi-ink underline-offset-4 hover:underline transition-colors"
          >
            drill all →
          </Link>
        }
      />

      <ul className="-mx-2 sm:-mx-3 divide-y divide-soft-hairline/60">
        {leeches.map((leech) => (
          <li key={leech.cardId}>
            <Link
              href={`/review?mode=drill&cardId=${leech.cardId}`}
              className="group flex items-center gap-3 px-2 sm:px-3 py-3 rounded-[2px] transition-colors duration-150 ease-out hover:bg-cream-inset focus-visible:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-1px]"
            >
              <span className="flex-1 min-w-0 flex items-baseline gap-2.5">
                <span lang="ja" className="truncate text-base text-sumi-ink font-medium">
                  {leech.word}
                </span>
                <span lang="ja" className="shrink-0 text-sm text-faded-sumi tracking-wide">
                  {leech.reading}
                </span>
              </span>

              <span className="shrink-0 flex items-center gap-4">
                <span className="font-mono text-sm tabular-nums text-sumi-ink">
                  {leech.errors}
                  <span className="ml-1 text-faded-sumi font-normal">errors</span>
                </span>
                <span className="text-faded-sumi transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-sumi-ink">
                  <ArrowGlyph direction="right" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
