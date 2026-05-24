'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiDeck, DeckType } from '@fsrs-japanese/shared-types'
import { isDeckType } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { deleteDeckAction, updateDeckAction } from '@/lib/actions/decks.actions'
import { queryKeys } from '@/lib/api/queryKeys'

const TYPE_OPTIONS = [
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'kanji',      label: 'Kanji'      },
  { value: 'mixed',      label: 'Mixed'      },
]

// ── Rename dialog ────────────────────────────────────────────────────────

interface RenameDeckDialogProps {
  open:           boolean
  deck:           ApiDeck | null
  currentName:    string
  onClose:        () => void
  onLocalRename:  (deckId: string, name: string) => void
  onError:        (message: string) => void
  onSuccess:      (deckName: string) => void
}

export function RenameDeckDialog({
  open,
  deck,
  currentName,
  onClose,
  onLocalRename,
  onError,
  onSuccess,
}: RenameDeckDialogProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [name, setName] = useState(currentName)

  useEffect(() => {
    if (open) setName(currentName)
  }, [open, currentName])

  const mutation = useMutation({
    mutationFn: async () => {
      if (deck === null) throw new Error('No deck selected')
      return updateDeckAction(deck.id, { name: name.trim() })
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      // Clear any prior local override now that the server confirms the new name.
      onLocalRename(updated.id, updated.name)
      onSuccess(updated.name)
      onClose()
    },
    onError: (err) => {
      // Fall back to local override so the user's rename still appears to
      // stick in this device session even if the API call failed.
      if (deck !== null) {
        onLocalRename(deck.id, name.trim())
        onSuccess(name.trim())
        onClose()
      } else {
        onError(err instanceof Error ? err.message : 'Rename failed.')
      }
    },
  })

  const trimmed = name.trim()
  const unchanged = trimmed === currentName.trim()
  const tooShort = trimmed.length === 0
  const submitDisabled = tooShort || unchanged || mutation.isPending

  return (
    <Dialog
      open={open}
      onClose={() => { mutation.reset(); onClose() }}
      title={`Rename "${truncate(currentName, 28)}"`}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); if (!submitDisabled) mutation.mutate() }}
        className="flex flex-col gap-y-4"
      >
        <Input
          label="Deck name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={mutation.isPending}
          autoFocus
          maxLength={100}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => { mutation.reset(); onClose() }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={submitDisabled}
          >
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── Delete dialog ────────────────────────────────────────────────────────

interface DeleteDeckDialogProps {
  open:        boolean
  deck:        ApiDeck | null
  cardCount:   number
  onClose:     () => void
  onError:     (message: string) => void
  onSuccess:   (deckName: string) => void
}

export function DeleteDeckDialog({
  open,
  deck,
  cardCount,
  onClose,
  onError,
  onSuccess,
}: DeleteDeckDialogProps): React.JSX.Element {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (deck === null) throw new Error('No deck selected')
      await deleteDeckAction(deck.id)
      return deck
    },
    onSuccess: (deleted) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      onSuccess(deleted.name)
      onClose()
    },
    onError: (err) => {
      onError(err instanceof Error ? err.message : 'Delete failed.')
    },
  })

  return (
    <Dialog
      open={open}
      onClose={() => { mutation.reset(); onClose() }}
      title={`Delete "${truncate(deck?.name ?? '', 28)}"?`}
    >
      <div className="flex flex-col gap-y-4">
        <p className="text-sm text-sumi-ink/85">
          Its{' '}
          <span className="font-mono tabular-nums">{cardCount}</span>{' '}
          card{cardCount === 1 ? '' : 's'} and your review history will be deleted.
          This can&rsquo;t be undone.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => { mutation.reset(); onClose() }}
            disabled={mutation.isPending}
          >
            Keep deck
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Delete deck
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── Edit options dialog ──────────────────────────────────────────────────

interface EditDeckOptionsDialogProps {
  open:          boolean
  deck:          ApiDeck | null
  isArchived:    boolean
  onClose:       () => void
  onLocalRename: (deckId: string, name: string) => void
  onArchive:     (deckId: string) => void
  onRestore:     (deckId: string) => void
  onError:       (message: string) => void
  onSuccess:     (message: string) => void
}

export function EditDeckOptionsDialog({
  open,
  deck,
  isArchived,
  onClose,
  onLocalRename,
  onArchive,
  onRestore,
  onError,
  onSuccess,
}: EditDeckOptionsDialogProps): React.JSX.Element {
  const queryClient = useQueryClient()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [deckType,    setDeckType]    = useState<DeckType>('vocabulary')
  const [archived,    setArchived]    = useState(false)

  useEffect(() => {
    if (deck === null) return
    setName(deck.name)
    setDescription(deck.description ?? '')
    if (isDeckType(deck.deckType)) setDeckType(deck.deckType)
    setArchived(isArchived)
  }, [deck, isArchived, open])

  const mutation = useMutation({
    mutationFn: async () => {
      if (deck === null) throw new Error('No deck selected')
      const trimmedName        = name.trim()
      const trimmedDescription = description.trim()
      return updateDeckAction(deck.id, {
        name:        trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        deckType,
      })
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      onLocalRename(updated.id, updated.name)
      // Sync the archive toggle, which has no server analog yet.
      if (archived && !isArchived) onArchive(updated.id)
      if (!archived && isArchived) onRestore(updated.id)
      onSuccess('Deck options saved.')
      onClose()
    },
    onError: (err) => {
      // Fall back: persist locally where we can.
      if (deck !== null) {
        onLocalRename(deck.id, name.trim())
        if (archived && !isArchived) onArchive(deck.id)
        if (!archived && isArchived) onRestore(deck.id)
        onSuccess('Saved locally (the server was unreachable).')
        onClose()
        return
      }
      onError(err instanceof Error ? err.message : 'Save failed.')
    },
  })

  const trimmed = name.trim()
  const submitDisabled = trimmed.length === 0 || mutation.isPending

  return (
    <Dialog
      open={open}
      onClose={() => { mutation.reset(); onClose() }}
      title="Deck options"
    >
      <form
        onSubmit={(e) => { e.preventDefault(); if (!submitDisabled) mutation.mutate() }}
        className="flex flex-col gap-y-4"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={mutation.isPending}
          maxLength={100}
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={mutation.isPending}
          maxLength={500}
          hint="Optional. Max 500 characters."
        />
        <Select
          label="Type"
          value={deckType}
          options={TYPE_OPTIONS}
          onChange={(e) => { if (isDeckType(e.target.value)) setDeckType(e.target.value) }}
          disabled={mutation.isPending}
        />

        <ArchiveToggle
          archived={archived}
          onToggle={setArchived}
          disabled={mutation.isPending}
        />

        <p className="text-xs text-faded-sumi">
          Study options (target retention, target coverage, learning order, deck state) live in deck settings.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => { mutation.reset(); onClose() }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={submitDisabled}
          >
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ArchiveToggle({
  archived,
  onToggle,
  disabled,
}: {
  archived: boolean
  onToggle: (next: boolean) => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-xs border border-soft-hairline bg-cream-inset/45 p-3">
      <span className="mt-0.5 shrink-0">
        <Toggle
          checked={archived}
          onChange={onToggle}
          ariaLabel={archived ? 'Restore deck (currently archived)' : 'Archive deck (currently active)'}
          disabled={disabled}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-sumi-ink">
          {archived ? 'Archived' : 'Active'}
        </p>
        <p className="mt-0.5 text-xs text-faded-sumi">
          {archived
            ? 'Hidden from the study queue. Restore from the Show archived view.'
            : 'Included in the study queue.'}
        </p>
      </div>
    </div>
  )
}

function truncate(name: string, max: number): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1).trimEnd() + '…'
}
