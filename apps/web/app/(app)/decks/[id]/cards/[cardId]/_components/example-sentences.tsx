'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { ExampleSentence } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { useGenerateSentences } from '@/lib/api/ai'
import { updateCardAction } from '@/lib/actions/cards.actions'
import { queryKeys } from '@/lib/api/queryKeys'
import { RegeneratePanel } from './regenerate-panel'

interface Props {
  cardId:         string
  sentences:      ExampleSentence[]
  fieldsData:     Record<string, unknown>
}

export function ExampleSentences({ cardId, sentences, fieldsData }: Props): React.JSX.Element {
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
      await updateCardAction(cardId, {
        fields_data: { ...fieldsData, exampleSentences: pending },
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(cardId) })
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Example Sentences</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={regenerate}
          loading={generate.isPending && pending === null}
          disabled={pending !== null}
        >
          Regenerate →
        </Button>
      </header>

      {pending !== null && (
        <RegeneratePanel
          title="New sentences"
          onUseThese={() => void useThese()}
          onTryAgain={regenerate}
          onDismiss={() => setPending(null)}
          isSaving={saving}
          isRegenerating={generate.isPending}
        >
          <SentenceList sentences={pending} />
        </RegeneratePanel>
      )}

      {generate.isError && pending === null && (
        <p className="text-sm text-danger-700" role="alert">
          {generate.error?.message ?? 'Unknown error'}
        </p>
      )}

      <div>
        {pending !== null && (
          <p className="text-xs text-neutral-400 mb-2">Current sentences:</p>
        )}
        <SentenceList sentences={sentences} dimmed={pending !== null} />
      </div>
    </section>
  )
}

function SentenceList({ sentences, dimmed = false }: { sentences: ExampleSentence[]; dimmed?: boolean }): React.JSX.Element {
  if (sentences.length === 0) {
    return <p className="text-sm text-neutral-400">No example sentences yet.</p>
  }
  return (
    <ul className={['space-y-4', dimmed ? 'opacity-60' : ''].join(' ')}>
      {sentences.map((s, i) => (
        <li key={i} className="space-y-0.5">
          <p lang="ja" className="text-base leading-[1.9]">{s.ja}</p>
          {s.furigana.length > 0 && (
            <p lang="ja" className="text-sm text-neutral-500 leading-[1.9]">{s.furigana}</p>
          )}
          <p className="text-sm text-neutral-500">{s.en}</p>
        </li>
      ))}
    </ul>
  )
}
