'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { useGenerateMnemonic } from '@/lib/api/ai'
import { updateCardAction } from '@/lib/actions/cards.actions'
import { queryKeys } from '@/lib/api/queryKeys'
import { RegeneratePanel } from './regenerate-panel'

interface Props {
  cardId:     string
  mnemonic:   string | undefined
  fieldsData: Record<string, unknown>
}

export function MnemonicSection({ cardId, mnemonic, fieldsData }: Props): React.JSX.Element {
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
      await updateCardAction(cardId, {
        fields_data: { ...fieldsData, mnemonic: pending },
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(cardId) })
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  // Don't render the section at all if there's nothing to show or do.
  if (mnemonic === undefined && pending === null && !generate.isPending && !generate.isError) {
    return (
      <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Mnemonic</h2>
        <p className="text-sm text-neutral-400">No mnemonic yet.</p>
        <Button variant="ghost" size="sm" onClick={regenerate} loading={generate.isPending}>
          Generate mnemonic →
        </Button>
      </section>
    )
  }

  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Mnemonic</h2>
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
          title="New mnemonic"
          onUseThese={() => void useThis()}
          onTryAgain={regenerate}
          onDismiss={() => setPending(null)}
          isSaving={saving}
          isRegenerating={generate.isPending}
        >
          <p className="text-base text-neutral-700 italic leading-relaxed">{pending}</p>
        </RegeneratePanel>
      )}

      {generate.isError && pending === null && (
        <p className="text-sm text-danger-700" role="alert">
          {generate.error?.message ?? 'Unknown error'}
        </p>
      )}

      {mnemonic !== undefined && (
        <div>
          {pending !== null && (
            <p className="text-xs text-neutral-400 mb-2">Current mnemonic:</p>
          )}
          <p className={[
            'text-base text-neutral-700 italic leading-relaxed',
            pending !== null ? 'opacity-60' : '',
          ].join(' ')}>
            {mnemonic}
          </p>
        </div>
      )}
    </section>
  )
}
