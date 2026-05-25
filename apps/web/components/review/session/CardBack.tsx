'use client'

import { useEffect, useState } from 'react'

import type { ApiDueCard } from '@fsrs-japanese/shared-types'

import { DefinitionPanel } from './DefinitionPanel'
import { SentenceBand }    from './SentenceBand'
import { WordStack }       from './WordStack'
import { resolveCardFields } from './card-fields'
import { useSessionPreferences } from '@/stores/useSessionPreferencesStore'
import { useSessionDevOverrides } from '@/stores/useSessionDevOverridesStore'
import { cn } from '@/lib/utils'

interface CardBackProps {
  card: ApiDueCard
  /**
   * Forwarded to `DefinitionPanel`. Enable on surfaces that render the card
   * back without `ReviewCard` (e.g. the card-detail page) so the tab-shortcut
   * hints become functional. Leave off inside a review session, where
   * `ReviewCard` already owns those keys. Defaults to off.
   */
  manageTabShortcuts?: boolean
  /**
   * Force the example-sentence translation to render unblurred regardless of
   * the learner's `autoRevealTranslation` session pref. The blur is a recall
   * affordance for the review back; on a static preview (card-detail page)
   * there is no rep to protect, so the full sentence should always show.
   * Defaults to off.
   */
  revealTranslation?: boolean
  /**
   * Pin which example sentence renders, bypassing the per-review rotation.
   * Used by the /add/review preview pager so the author can step through
   * every sentence. Omitted in a real review session, where the back rotates
   * stable-randomly across the card's example sentences.
   */
  exampleSentenceIndex?: number
}

// One composition for every card type (v4): the WordStack carries the
// dictionary headword (pitch staff, kanji, reading, definition); the picture
// (if any) sits beside it on desktop; the sentence is always visible below;
// the DefinitionPanel surfaces only study-note tabs (Nuance leads).
//
// The card frame is static (the SectionCard handles edges); the body
// content lands in three staggered waves.

export function CardBack({
  card,
  manageTabShortcuts = false,
  revealTranslation  = false,
  exampleSentenceIndex,
}: CardBackProps): React.JSX.Element {
  const fields    = resolveCardFields(card, exampleSentenceIndex)
  const prefs     = useSessionPreferences()
  const overrides = useSessionDevOverrides()
  const [stage, setStage] = useState(0)

  useEffect(() => {
    setStage(0)
    if (overrides.prefersReducedMotion) {
      setStage(3)
      return
    }
    const t1 = window.setTimeout(() => setStage((s) => Math.max(s, 1)), 0)
    const t2 = window.setTimeout(() => setStage((s) => Math.max(s, 2)), 60)
    const t3 = window.setTimeout(() => setStage((s) => Math.max(s, 3)), 120)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [card.id, overrides.prefersReducedMotion])

  const hasPicture = fields.picture !== null

  return (
    <article aria-live="polite" className="flex w-full flex-col gap-7 md:gap-9">
      {/* The Frequency badge now lives in the bonded top row owned by
          ReviewCard (alongside the ⋯ menu), so it bonds the card's top edge
          for both front and back states. */}
      <Stage at={1} active={stage}>
        <div
          className={cn(
            'flex w-full flex-col gap-6',
            hasPicture && 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)] md:items-center md:gap-10',
          )}
        >
          {hasPicture && (
            <Stage at={2} active={stage} className="order-first md:order-last">
              <Picture src={fields.picture ?? ''} alt={fields.word} />
            </Stage>
          )}
          <div className={cn('flex w-full justify-center', hasPicture && 'md:order-first md:justify-self-center')}>
            <WordStack
              word={fields.word}
              reading={fields.reading}
              meaning={fields.meaning}
              partOfSpeech={fields.partOfSpeech}
              jlptLevel={fields.jlptLevel}
              pitchPosition={fields.pitchPosition}
            />
          </div>
        </div>
      </Stage>

      {fields.exampleSentence !== null && (
        <Stage at={2} active={stage}>
          <div className="pt-2">
            <p className="font-display text-sm font-medium text-faded-sumi mb-2">
              Sentence
            </p>
            <SentenceBand
              ja={fields.exampleSentence.ja}
              furigana={fields.exampleSentence.furigana}
              en={fields.exampleSentence.en}
              furiganaMode={prefs.furiganaMode}
              autoRevealTranslation={prefs.autoRevealTranslation || revealTranslation}
              // Pager-driven index: when a preview steps to another example,
              // SentenceBand replays its entrance as a switch cue. Undefined in
              // a review session (no pager), so the cue stays out of practice.
              swapToken={exampleSentenceIndex}
            />
          </div>
        </Stage>
      )}

      <Stage at={3} active={stage}>
        <DefinitionPanel
          nuance={fields.nuance}
          mnemonic={fields.mnemonic}
          kanjiBreakdown={fields.kanjiBreakdown}
          manageShortcuts={manageTabShortcuts}
        />
      </Stage>
    </article>
  )
}

function Stage({
  at,
  active,
  className,
  children,
}: {
  at:        number
  active:    number
  className?: string
  children:  React.ReactNode
}): React.JSX.Element {
  const visible = active >= at
  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-300 ease-out-expo',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Picture({ src, alt }: { src: string; alt: string }): React.JSX.Element {
  // min-h reserves vertical space so the mnemonic loading doesn't shift the
  // card-back layout (CLS). A complete fix would reserve the exact aspect from
  // API-supplied image dimensions; this floor + object-contain bounds the shift
  // without guessing each image's ratio.
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center md:justify-end">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="max-h-[260px] md:max-h-[300px] w-auto rounded-xs border border-soft-hairline bg-cream-inset/30 object-contain"
      />
    </div>
  )
}
