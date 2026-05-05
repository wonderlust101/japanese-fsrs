'use client'

import { useState }    from 'react'
import Link            from 'next/link'
import { useQuery }    from '@tanstack/react-query'

import { TopBar }                from '@/app/(app)/_components/top-bar'
import { Button }                from '@/components/ui/Button'
import { FuriganaText }          from '@/components/ui/FuriganaText'
import { queryKeys }             from '@/lib/api/queryKeys'
import { getCardAction, getSimilarCardsAction } from '@/lib/actions/cards.actions'
import { CardListItem }          from '../../../_components/card-list-item'
import { FsrsStats }             from './fsrs-stats'
import { ExampleSentences }      from './example-sentences'
import { KanjiBreakdown }        from './kanji-breakdown'
import { MnemonicSection }       from './mnemonic-section'

// ─── JLPT badge ───────────────────────────────────────────────────────────────

const JLPT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  N5:          { bg: 'var(--color-jlpt-n5-bg)',      text: 'var(--color-jlpt-n5-text)',      label: 'N5' },
  N4:          { bg: 'var(--color-jlpt-n4-bg)',      text: 'var(--color-jlpt-n4-text)',      label: 'N4' },
  N3:          { bg: 'var(--color-jlpt-n3-bg)',      text: 'var(--color-jlpt-n3-text)',      label: 'N3' },
  N2:          { bg: 'var(--color-jlpt-n2-bg)',      text: 'var(--color-jlpt-n2-text)',      label: 'N2' },
  N1:          { bg: 'var(--color-jlpt-n1-bg)',      text: 'var(--color-jlpt-n1-text)',      label: 'N1' },
  beyond_jlpt: { bg: 'var(--color-jlpt-beyond-bg)', text: 'var(--color-jlpt-beyond-text)',  label: '∞'  },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  deckId:   string
  cardId:   string
  deckName: string
}

export function CardDetailView({ deckId, cardId, deckName }: Props): React.JSX.Element {
  const [showSimilar, setShowSimilar] = useState(false)

  const { data: card, isLoading } = useQuery({
    queryKey: queryKeys.cards.detail(cardId),
    queryFn:  () => getCardAction(deckId, cardId),
  })

  const { data: similar, isLoading: loadingSimilar } = useQuery({
    queryKey: queryKeys.cards.similar(cardId),
    queryFn:  () => getSimilarCardsAction(cardId),
    enabled:  showSimilar,
  })

  // ── Extract fieldsData fields ──────────────────────────────────────────────
  // FieldsData is a discriminated union; widen to Record for cross-layout access.
  const fd              = (card?.fieldsData ?? {}) as Record<string, unknown>
  const word            = (fd['word']             as string | undefined) ?? (fd['front'] as string | undefined) ?? '—'
  const reading         = (fd['reading']          as string | undefined) ?? ''
  const meaning         = (fd['meaning']          as string | undefined) ?? (fd['back'] as string | undefined) ?? ''
  const partOfSpeech    = (fd['partOfSpeech']     as string | undefined)
  const pitchAccent     = (fd['pitchAccent']      as string | undefined)
  const mnemonic        = (fd['mnemonic']         as string | undefined)
  const exampleSentences = fd['exampleSentences'] as { ja: string; en: string; furigana: string }[] | undefined
  const kanjiBreakdown   = fd['kanjiBreakdown']   as { kanji: string; meaning: string }[]   | undefined

  const jlpt = card?.jlptLevel !== null && card?.jlptLevel !== undefined
    ? JLPT_STYLE[card.jlptLevel]
    : undefined

  return (
    <>
      <TopBar>
        <Link
          href={`/decks/${deckId}`}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors shrink-0"
        >
          ← <span className="max-w-32 truncate">{deckName}</span>
        </Link>
        <span className="text-neutral-300 shrink-0" aria-hidden="true">|</span>
        <span className="flex-1 text-base font-semibold text-neutral-900 truncate" lang="ja">{word}</span>
        <Link href={`/decks/${deckId}/cards/${cardId}/edit`}>
          <Button variant="secondary" size="sm">Edit</Button>
        </Link>
      </TopBar>

      <div className="max-w-[760px] mx-auto px-4 lg:px-6 py-6 space-y-5 animate-page-enter">

        {/* ── Main card ───────────────────────────────────────────────── */}
        <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-6 space-y-3">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-9 w-48 bg-neutral-200 rounded" />
              <div className="h-6 w-72 bg-neutral-100 rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-neutral-100 rounded-full" />
                <div className="h-5 w-10 bg-neutral-100 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                {reading.length > 0 ? (
                  <FuriganaText text={word} reading={reading} className="text-3xl font-bold leading-snug" />
                ) : (
                  <span lang="ja" className="text-3xl font-bold leading-snug">{word}</span>
                )}
                {pitchAccent !== undefined && (
                  <span className="text-sm text-neutral-400">{pitchAccent}</span>
                )}
              </div>
              <p className="text-xl text-neutral-700">{meaning}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {partOfSpeech !== undefined && (
                  <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{partOfSpeech}</span>
                )}
                {jlpt !== undefined && (
                  <span
                    className="px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: jlpt.bg, color: jlpt.text }}
                  >
                    {jlpt.label}
                  </span>
                )}
                {card?.tags?.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{tag}</span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Example Sentences ───────────────────────────────────────── */}
        {!isLoading && (
          <ExampleSentences
            cardId={cardId}
            sentences={exampleSentences ?? []}
            fieldsData={fd}
          />
        )}

        {/* ── Kanji Breakdown ─────────────────────────────────────────── */}
        {kanjiBreakdown !== undefined && kanjiBreakdown.length > 0 && (
          <KanjiBreakdown breakdown={kanjiBreakdown} />
        )}

        {/* ── Mnemonic ────────────────────────────────────────────────── */}
        {!isLoading && (
          <MnemonicSection
            cardId={cardId}
            mnemonic={mnemonic}
            fieldsData={fd}
          />
        )}

        {/* ── FSRS Stats ──────────────────────────────────────────────── */}
        {card !== undefined && card !== null && <FsrsStats card={card} />}

        {/* ── Similar Cards ───────────────────────────────────────────── */}
        <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Similar Cards</h2>
          {!showSimilar && (
            <Button variant="secondary" size="sm" onClick={() => setShowSimilar(true)}>
              View Similar Cards
            </Button>
          )}
          {showSimilar && loadingSimilar && (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-neutral-100 rounded-[var(--radius-md)]" />
              ))}
            </div>
          )}
          {showSimilar && !loadingSimilar && (similar === undefined || similar.length === 0) && (
            <p className="text-sm text-neutral-500">No similar cards found yet.</p>
          )}
          {showSimilar && !loadingSimilar && similar !== undefined && similar.length > 0 && (
            <ul className="space-y-2">
              {similar.map((c) => (
                <CardListItem key={c.id} card={c} deckId={deckId} />
              ))}
            </ul>
          )}
        </section>

      </div>
    </>
  )
}
