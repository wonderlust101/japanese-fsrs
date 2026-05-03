'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

import { TopBar }                from '@/app/(app)/_components/top-bar'
import { Button }                from '@/components/ui/button'
import { Input }                 from '@/components/ui/input'
import { CardSkeleton }          from './card-skeleton'
import { GeneratedCardPreview }  from './card-preview'
import { generateCardPreviewAction, saveCardAction } from '@/lib/actions/cards.actions'
import type { GeneratedCardData } from '@/lib/actions/cards.actions'
import { queryKeys } from '@/lib/api/queryKeys'

type Phase = 'input' | 'generating' | 'preview' | 'saving'

interface Props {
  deckId:   string
  deckName: string
}

export function AddCardForm({ deckId, deckName }: Props) {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const [word,    setWord]    = useState('')
  const [phase,   setPhase]   = useState<Phase>('input')
  const [preview, setPreview] = useState<GeneratedCardData | null>(null)

  const generateMutation = useMutation({
    mutationFn: () => generateCardPreviewAction(word.trim()),
    onSuccess: (data) => {
      setPreview(data)
      setPhase('preview')
    },
    onError: () => {
      setPhase('input')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => saveCardAction(deckId, { fields_data: preview! }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      router.push(`/decks/${deckId}`)
    },
  })

  function handleGenerate() {
    if (word.trim().length === 0) return
    setPhase('generating')
    generateMutation.reset()
    generateMutation.mutate()
  }

  const isWorking = phase === 'generating' || phase === 'saving'

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
                ? (generateMutation.error as Error).message
                : undefined
            }
          />

          <Button
            onClick={handleGenerate}
            loading={phase === 'generating'}
            disabled={word.trim().length === 0 || isWorking}
            className="w-full"
          >
            ✨ Generate with AI
          </Button>
        </div>

        {/* ── Skeleton ─────────────────────────────────────────────── */}
        {phase === 'generating' && <CardSkeleton />}

        {/* ── Preview card ─────────────────────────────────────────── */}
        {(phase === 'preview' || phase === 'saving') && preview !== null && (
          <GeneratedCardPreview data={preview} />
        )}

        {/* ── Action row ───────────────────────────────────────────── */}
        {(phase === 'preview' || phase === 'saving') && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setPhase('input')}
              disabled={phase === 'saving'}
            >
              ← Edit word
            </Button>

            <Button
              onClick={() => {
                setPhase('saving')
                saveMutation.mutate()
              }}
              loading={phase === 'saving'}
              disabled={phase === 'saving'}
            >
              Add to Deck →
            </Button>
          </div>
        )}

        {/* ── Save error ───────────────────────────────────────────── */}
        {saveMutation.isError && (
          <p role="alert" className="text-sm text-danger-500">
            {(saveMutation.error as Error).message}
          </p>
        )}

      </div>
    </>
  )
}
