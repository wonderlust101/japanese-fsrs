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
}

// One composition for every card type (v4): the WordStack carries the
// dictionary headword (pitch staff, kanji, reading, definition); the picture
// (if any) sits beside it on desktop; the sentence is always visible below;
// the DefinitionPanel surfaces only study-note tabs (Nuance leads).
//
// The card frame is static (the SectionCard handles edges); the body
// content lands in three staggered waves.

export function CardBack({ card }: CardBackProps): React.JSX.Element {
  const fields    = resolveCardFields(card)
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
              expressionAudio={fields.expressionAudio}
              audioMuted={prefs.audioMuted}
            />
          </div>
        </div>
      </Stage>

      {fields.exampleSentence !== null && (
        <Stage at={2} active={stage}>
          <div className="pt-2">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi mb-2">
              Sentence
            </p>
            <SentenceBand
              ja={fields.exampleSentence.ja}
              furigana={fields.exampleSentence.furigana}
              en={fields.exampleSentence.en}
              audioSrc={fields.exampleSentence.audio}
              furiganaMode={prefs.furiganaMode}
              audioMuted={prefs.audioMuted}
              autoplay
            />
          </div>
        </Stage>
      )}

      <Stage at={3} active={stage}>
        <DefinitionPanel
          nuance={fields.nuance}
          mnemonic={fields.mnemonic}
          kanjiBreakdown={fields.kanjiBreakdown}
          collocations={fields.collocations}
          homophones={fields.homophones}
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
        'transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Picture({ src, alt }: { src: string; alt: string }): React.JSX.Element {
  return (
    <div className="flex w-full justify-center md:justify-end">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="max-h-[260px] md:max-h-[300px] w-auto rounded-md border border-soft-hairline bg-cream-inset/30 object-contain"
      />
    </div>
  )
}
