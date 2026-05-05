'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

import { TopBar }                from '@/app/(app)/_components/top-bar'
import { Button }                from '@/components/ui/Button'
import { Input }                 from '@/components/ui/Input'
import { CardSkeleton }          from './card-skeleton'
import { GeneratedCardPreview }  from './card-preview'
import { generateCardPreviewAction, saveCardAction } from '@/lib/actions/cards.actions'
import type { GeneratedCardData } from '@fsrs-japanese/shared-types'
import { queryKeys } from '@/lib/api/queryKeys'

// Discriminated union — `preview` is only present once generation succeeds,
// and once present it stays attached through 'saving'. The four flat-state
// invalid combinations (preview without phase, etc.) become unrepresentable.
type FormState =
  | { phase: 'input' }
  | { phase: 'generating' }
  | { phase: 'preview';   preview: GeneratedCardData }
  | { phase: 'saving';    preview: GeneratedCardData }

interface Props {
  deckId:   string
  deckName: string
}

export function AddCardForm({ deckId, deckName }: Props): React.JSX.Element {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const [word,      setWord]      = useState('')
  const [formState, setFormState] = useState<FormState>({ phase: 'input' })

  const generateMutation = useMutation({
    mutationFn: () => generateCardPreviewAction(word.trim()),
    onSuccess: (data) => {
      setFormState({ phase: 'preview', preview: data })
    },
    onError: () => {
      setFormState({ phase: 'input' })
    },
  })

  const saveMutation = useMutation({
    // The mutate caller passes `preview` explicitly (captured at click time
    // from the narrowed 'preview'-phase state) — no nullable closure needed.
    mutationFn: (preview: GeneratedCardData) =>
      saveCardAction(deckId, { fields_data: preview }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      router.push(`/decks/${deckId}`)
    },
  })

  function handleGenerate() {
    if (word.trim().length === 0) return
    setFormState({ phase: 'generating' })
    generateMutation.reset()
    generateMutation.mutate()
  }

  function handleSave() {
    if (formState.phase !== 'preview') return
    const { preview } = formState
    setFormState({ phase: 'saving', preview })
    saveMutation.mutate(preview)
  }

  const isWorking = formState.phase === 'generating' || formState.phase === 'saving'
  const showPreview = formState.phase === 'preview' || formState.phase === 'saving'
  const isSaving    = formState.phase === 'saving'

  return (
    <>
      <TopBar>
        <Link
          href={`/decks/${deckId}`}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors shrink-0"
        >
          ← <span className="max-w-40 truncate">{deckName}</span>
        </Link>
        <span className="text-neutral-300 shrink-0" aria-hidden="true">|</span>
        <span className="text-base font-medium text-neutral-900">Add New Card</span>
      </TopBar>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── Word input ────────────────────────────────────────────── */}
        <div className="bg-neutral-0 rounded-[var(--radius-lg)] border border-neutral-200 p-6 space-y-4">
          <Input
            label="Japanese word or sentence"
            lang="ja"
            placeholder="木漏れ日"
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleGenerate()
            }}
            disabled={isWorking}
            error={
              generateMutation.isError
                ? generateMutation.error?.message ?? 'Unknown error'
                : undefined
            }
          />

          <Button
            onClick={handleGenerate}
            loading={formState.phase === 'generating'}
            disabled={word.trim().length === 0 || isWorking}
            className="w-full"
          >
            ✨ Generate with AI
          </Button>
        </div>

        {/* ── Skeleton ─────────────────────────────────────────────── */}
        {formState.phase === 'generating' && <CardSkeleton />}

        {/* ── Preview card ─────────────────────────────────────────── */}
        {showPreview && (
          <GeneratedCardPreview data={formState.preview} />
        )}

        {/* ── Action row ───────────────────────────────────────────── */}
        {showPreview && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setFormState({ phase: 'input' })}
              disabled={isSaving}
            >
              ← Edit word
            </Button>

            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving}
            >
              Add to Deck →
            </Button>
          </div>
        )}

        {/* ── Save error ───────────────────────────────────────────── */}
        {saveMutation.isError && (
          <p role="alert" className="text-sm text-danger-500">
            {saveMutation.error?.message ?? 'Unknown error'}
          </p>
        )}

      </div>
    </>
  )
}
