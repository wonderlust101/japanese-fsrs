'use client'

import { useState }                    from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Dialog }           from '@/components/ui/Dialog'
import { Input }            from '@/components/ui/Input'
import { Select }           from '@/components/ui/Select'
import { Button }           from '@/components/ui/Button'
import { createDeckAction } from '@/lib/actions/decks.actions'
import { queryKeys }        from '@/lib/api/queryKeys'
import { isDeckType, type DeckType } from '@fsrs-japanese/shared-types'

const TYPE_OPTIONS = [
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'grammar',    label: 'Grammar'    },
  { value: 'kanji',      label: 'Kanji'      },
  { value: 'mixed',      label: 'Mixed'      },
]

interface Props {
  open:    boolean
  onClose: () => void
}

export function CreateDeckDialog({ open, onClose }: Props): React.JSX.Element {
  const queryClient = useQueryClient()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [deckType,    setDeckType]    = useState<DeckType>('vocabulary')

  const mutation = useMutation({
    mutationFn: () => createDeckAction({
      name:        name.trim(),
      description: description.trim() || undefined,
      deck_type:   deckType,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      handleClose()
    },
  })

  function handleClose() {
    setName('')
    setDescription('')
    setDeckType('vocabulary')
    mutation.reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="New Deck">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
        className="space-y-4"
      >
        <Input
          label="Name"
          placeholder="N5 Vocabulary"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={mutation.isPending}
          autoFocus
        />
        <Input
          label="Description"
          placeholder="Optional — what this deck covers"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={mutation.isPending}
          hint="Max 500 characters"
        />
        <Select
          label="Type"
          value={deckType}
          options={TYPE_OPTIONS}
          onChange={(e) => { if (isDeckType(e.target.value)) setDeckType(e.target.value) }}
          disabled={mutation.isPending}
        />

        {mutation.isError && (
          <p role="alert" className="text-xs text-danger-500">
            {mutation.error?.message ?? 'Unknown error'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={name.trim().length === 0 || mutation.isPending}
          >
            Create Deck
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
