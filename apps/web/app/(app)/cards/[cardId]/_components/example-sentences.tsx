'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { ExampleSentence } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { SectionCard } from '@/components/ui/SectionCard'
import { useGenerateSentences } from '@/lib/api/ai'
import { updateCardAction } from '@/lib/actions/cards.actions'
import { queryKeys } from '@/lib/api/queryKeys'
import { RegeneratePanel } from './regenerate-panel'

interface Props {
  cardId:              string
  cardVersion:         number
  sentences:           ExampleSentence[]
  fieldsData:          Record<string, unknown>
  /** Called when the user clicks a sentence's play-audio button. The audio
   *  field isn't in the schema yet, so this is a no-op-toast stub from the
   *  caller until the backend ships sentence audio URLs. */
  onPlaySentenceAudio?: (sentence: ExampleSentence) => void
}

export function ExampleSentences({ cardId, cardVersion, sentences, fieldsData, onPlaySentenceAudio }: Props): React.JSX.Element {
  const [pending, setPending] = useState<ExampleSentence[] | null>(null)
  const [saving,  setSaving]  = useState(false)

  const queryClient = useQueryClient()
  const generate    = useGenerateSentences(cardId)

  function regenerate(): void {
    generate.mutate(undefined, {
      onSuccess: (data) => setPending(data.sentences),
    })
  }

  async function useThese(): Promise<void> {
    if (pending === null) return
    setSaving(true)
    try {
      await updateCardAction(cardId, cardVersion, {
        fieldsData: { ...fieldsData, exampleSentences: pending },
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(cardId) })
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  const isEmpty = sentences.length === 0 && pending === null && !generate.isPending && !generate.isError

  return (
    <SectionCard
      kanji="例"
      label="Sentences"
      rightContent={
        isEmpty ? undefined : (
          <Button
            variant="ghost"
            size="sm"
            onClick={regenerate}
            loading={generate.isPending && pending === null}
            disabled={pending !== null}
          >
            Regenerate
          </Button>
        )
      }
    >
      {isEmpty ? (
        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-faded-sumi">No example sentences yet. Context helps the card stick.</p>
          <Button variant="secondary" size="sm" onClick={regenerate} loading={generate.isPending}>
            Generate sentences
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {pending !== null && (
            <RegeneratePanel
              title="New sentences"
              onUseThese={() => void useThese()}
              onTryAgain={regenerate}
              onDismiss={() => setPending(null)}
              isSaving={saving}
              isRegenerating={generate.isPending}
            >
              <SentencePairList sentences={pending} {...(onPlaySentenceAudio !== undefined ? { onPlayAudio: onPlaySentenceAudio } : {})} />
            </RegeneratePanel>
          )}

          {generate.isError && pending === null && (
            <p className="text-sm text-inari-vermillion-deep" role="alert">
              {generate.error?.message ?? 'Unknown error'}
            </p>
          )}

          <div>
            {pending !== null && (
              <p className="mb-3 text-xs text-faded-sumi">Current sentences:</p>
            )}
            <SentencePairList
              sentences={sentences}
              dimmed={pending !== null}
              {...(onPlaySentenceAudio !== undefined ? { onPlayAudio: onPlaySentenceAudio } : {})}
            />
          </div>
        </div>
      )}
    </SectionCard>
  )
}

/**
 * Japanese-left / English-right pair layout. On mobile, each pair stacks
 * (Japanese above translation). On md+, they sit side by side sharing a row.
 * Pairs are separated by hairline rules so the eye can group each unit.
 */
function SentencePairList({
  sentences,
  dimmed = false,
  onPlayAudio,
}: {
  sentences:    ExampleSentence[]
  dimmed?:      boolean
  onPlayAudio?: (sentence: ExampleSentence) => void
}): React.JSX.Element {
  if (sentences.length === 0) {
    return <p className="text-sm text-faded-sumi">No example sentences yet.</p>
  }
  return (
    <ul className={dimmed ? 'opacity-60' : ''}>
      {sentences.map((s, i) => (
        <li
          key={i}
          className={[
            'grid grid-cols-1 gap-x-8 gap-y-2 py-4 md:grid-cols-2',
            i === 0 ? 'pt-0' : 'border-t border-soft-hairline',
          ].join(' ')}
        >
          <div className="flex items-baseline gap-2">
            <div className="min-w-0 flex-1">
              <p lang="ja" className="text-base leading-[1.9] text-sumi-ink">{s.ja}</p>
              {s.furigana.length > 0 && (
                <p lang="ja" className="text-sm leading-[1.6] text-faded-sumi">{s.furigana}</p>
              )}
            </div>
            {onPlayAudio !== undefined && (
              <button
                type="button"
                onClick={() => onPlayAudio(s)}
                aria-label="Play sentence audio"
                className="ui-motion-colors mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                  <path d="M2 1.5l6 3.5-6 3.5z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-base leading-[1.9] text-sumi-ink/85">{s.en}</p>
        </li>
      ))}
    </ul>
  )
}
