'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { SectionCard } from '@/components/ui/SectionCard'
import { useGenerateMnemonic } from '@/lib/api/ai'
import { updateCardAction } from '@/lib/actions/cards.actions'
import { queryKeys } from '@/lib/api/queryKeys'
import { RegeneratePanel } from './regenerate-panel'

interface Props {
  cardId:      string
  cardVersion: number
  mnemonic?:   string
  fieldsData:  Record<string, unknown>
}

export function MnemonicSection({ cardId, cardVersion, mnemonic, fieldsData }: Props): React.JSX.Element {
  const [pending, setPending] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  const queryClient = useQueryClient()
  const generate    = useGenerateMnemonic(cardId)

  function regenerate(): void {
    generate.mutate(undefined, {
      onSuccess: (data) => setPending(data.mnemonic),
    })
  }

  async function useThis(): Promise<void> {
    if (pending === null) return
    setSaving(true)
    try {
      await updateCardAction(cardId, cardVersion, {
        fieldsData: { ...fieldsData, mnemonic: pending },
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(cardId) })
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  const isEmpty = mnemonic === undefined && pending === null && !generate.isPending && !generate.isError

  return (
    <SectionCard
      kanji="記"
      label="Mnemonic"
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
        // Quality suggestion: friendly framing, action inline.
        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-faded-sumi">No mnemonic yet. A short memory hook can help this card stick.</p>
          <Button variant="secondary" size="sm" onClick={regenerate} loading={generate.isPending}>
            Generate mnemonic
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {pending !== null && (
            <RegeneratePanel
              title="New mnemonic"
              onUseThese={() => void useThis()}
              onTryAgain={regenerate}
              onDismiss={() => setPending(null)}
              isSaving={saving}
              isRegenerating={generate.isPending}
            >
              <p className="text-base italic leading-relaxed text-sumi-ink">{pending}</p>
            </RegeneratePanel>
          )}

          {generate.isError && pending === null && (
            <p className="text-sm text-inari-vermillion-deep" role="alert">
              {generate.error?.message ?? 'Unknown error'}
            </p>
          )}

          {mnemonic !== undefined && (
            <div>
              {pending !== null && (
                <p className="mb-2 text-xs text-faded-sumi">Current mnemonic:</p>
              )}
              <p className={[
                'text-base italic leading-relaxed text-sumi-ink',
                pending !== null ? 'opacity-60' : '',
              ].join(' ')}>
                {mnemonic}
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
