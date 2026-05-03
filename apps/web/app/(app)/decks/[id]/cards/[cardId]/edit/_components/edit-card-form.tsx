'use client'

import { useState }                    from 'react'
import { useRouter }                   from 'next/navigation'
import Link                            from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { TopBar }       from '@/app/(app)/_components/top-bar'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Select }       from '@/components/ui/select'
import { Dialog }       from '@/components/ui/dialog'
import { FuriganaText } from '@/components/ui/furigana-text'
import { updateCardAction, deleteCardAction } from '@/lib/actions/cards.actions'
import type { CardDetail }              from '@/lib/actions/cards.actions'
import { queryKeys }                   from '@/lib/api/queryKeys'

// ─── JLPT options ─────────────────────────────────────────────────────────────

const JLPT_OPTIONS = [
  { value: '',            label: 'None'        },
  { value: 'N5',          label: 'N5'          },
  { value: 'N4',          label: 'N4'          },
  { value: 'N3',          label: 'N3'          },
  { value: 'N2',          label: 'N2'          },
  { value: 'N1',          label: 'N1'          },
  { value: 'beyond_jlpt', label: 'Beyond JLPT' },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  card:     CardDetail
  deckId:   string
  deckName: string
}

export function EditCardForm({ card, deckId, deckName }: Props) {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const fd = card.fieldsData
  const [word,      setWord]      = useState((fd['word']    as string | undefined) ?? '')
  const [reading,   setReading]   = useState((fd['reading'] as string | undefined) ?? '')
  const [meaning,   setMeaning]   = useState((fd['meaning'] as string | undefined) ?? '')
  const [jlptLevel, setJlptLevel] = useState(card.jlptLevel ?? '')
  const [tags,      setTags]      = useState((card.tags ?? []).join(', '))
  const [deleteOpen, setDeleteOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => updateCardAction(card.id, {
      fields_data: { ...fd, word: word.trim(), reading: reading.trim(), meaning: meaning.trim() },
      jlpt_level:  jlptLevel === '' ? null : jlptLevel,
      tags:        tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(card.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      router.push(`/decks/${deckId}/cards/${card.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCardAction(card.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      router.push(`/decks/${deckId}`)
    },
  })

  const originalWord = (fd['word'] as string | undefined) ?? ''

  return (
    <>
      <TopBar>
        <Link
          href={`/decks/${deckId}/cards/${card.id}`}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors shrink-0"
        >
          ← <span lang="ja" className="max-w-32 truncate">{originalWord || deckName}</span>
        </Link>
        <span className="text-neutral-300 shrink-0" aria-hidden="true">|</span>
        <span className="flex-1 text-base font-semibold text-neutral-900">Edit Card</span>
      </TopBar>

      <div className="max-w-[640px] mx-auto px-4 lg:px-6 py-6">
        <form
          onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}
          className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-6 space-y-5"
        >

          <Input
            label="Word"
            lang="ja"
            placeholder="木漏れ日"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            disabled={saveMutation.isPending}
            autoFocus
          />

          <div className="space-y-2">
            <Input
              label="Reading"
              lang="ja"
              placeholder="こもれび"
              value={reading}
              onChange={(e) => setReading(e.target.value)}
              disabled={saveMutation.isPending}
              hint="Hiragana or katakana reading"
            />
            {word.trim().length > 0 && reading.trim().length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-neutral-400 shrink-0">Preview:</span>
                <FuriganaText
                  text={word.trim()}
                  reading={reading.trim()}
                  className="text-xl font-semibold text-neutral-900"
                />
              </div>
            )}
          </div>

          <Input
            label="Meaning"
            placeholder="Sunlight filtering through leaves"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            disabled={saveMutation.isPending}
          />

          <Select
            label="JLPT Level"
            value={jlptLevel}
            options={JLPT_OPTIONS}
            onChange={(e) => setJlptLevel(e.target.value)}
            disabled={saveMutation.isPending}
          />

          <Input
            label="Tags"
            placeholder="nature, poetry"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={saveMutation.isPending}
            hint="Comma-separated"
          />

          {saveMutation.isError && (
            <p role="alert" className="text-sm text-danger-500">
              {(saveMutation.error as Error).message}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={saveMutation.isPending || deleteMutation.isPending}
            >
              Delete Card
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={saveMutation.isPending}
                disabled={word.trim().length === 0 || meaning.trim().length === 0 || deleteMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </div>

        </form>
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Card">
        <p className="text-sm text-neutral-600 mb-5">
          Permanently delete{' '}
          <span lang="ja" className="font-semibold text-neutral-900">"{word || 'this card'}"</span>
          ? This cannot be undone.
        </p>
        {deleteMutation.isError && (
          <p role="alert" className="text-sm text-danger-500 mb-3">
            {(deleteMutation.error as Error).message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  )
}
