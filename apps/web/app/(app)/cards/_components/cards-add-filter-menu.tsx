'use client'

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type {
  CardMissingField,
  CardPresentField,
  PitchPattern,
} from '@fsrs-japanese/shared-types'

import { CommandList, type CommandItem } from '@/components/ui/CommandList'

import type { CardsFilterState } from './cards-filter-state'

interface Props {
  open:      boolean
  anchorRef: React.RefObject<HTMLElement | null>
  state:     CardsFilterState
  onApply:   (next: CardsFilterState) => void
  onClose:   () => void
}

/**
 * Typeahead command menu invoked from the toolbar's `+ Add filter`
 * trigger. The list rendering, keyboard navigation, and
 * `aria-activedescendant` are delegated to the shared `CommandList`
 * primitive; this component owns the popover chrome (position, header,
 * search input, key hint footer) and the entry catalogue.
 */
export function CardsAddFilterMenu({
  open, anchorRef, state, onApply, onClose,
}: Props): React.JSX.Element | null {
  const headingId = useId()
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [open])

  useLayoutEffect(() => {
    if (!open) return undefined
    const update = (): void => {
      const trigger = anchorRef.current
      if (trigger === null) return
      const rect = trigger.getBoundingClientRect()
      const width = 320
      const left = Math.max(8, rect.right - width)
      setPosition({ top: rect.bottom + 8, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) === true) return
      if (anchorRef.current?.contains(target) === true) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, anchorRef, onClose])

  const entries = useMemo(() => buildEntries(state), [state])
  const filtered = useMemo(() => filterEntries(entries, query), [entries, query])

  if (!open || !mounted || position === null) return null

  // Convert entry catalogue into CommandList items. `inactive` (already
  // applied) becomes the badge, `header` controls section grouping.
  const items: ReadonlyArray<CommandItem<string>> = filtered.map((entry) => ({
    value: entry.id,
    label: entry.label,
    hint:  entry.hint,
    badge: entry.inactive === true ? '●' : undefined,
    header: entry.group,
  }))

  function commit(value: string): void {
    const entry = entries.find((e) => e.id === value)
    if (entry === undefined) return
    onApply(entry.apply(state))
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      style={{ top: position.top, left: position.left, position: 'fixed', width: 320 }}
      className="z-50 rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-card animate-page-enter"
    >
      <div className="border-b border-soft-hairline px-3 pt-3 pb-2">
        <h2 id={headingId} className="font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
          Add a filter
        </h2>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by pitch, picture…"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          className="mt-2 w-full rounded-[2px] border border-soft-hairline bg-warm-paper-base px-2 py-1.5 text-sm text-sumi-ink placeholder:text-faded-sumi focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-1"
          aria-label="Search filters"
        />
      </div>

      <CommandList<string>
        items={items}
        inputRef={inputRef}
        onSelect={commit}
        onEscape={onClose}
        empty={`No filter matches “${query.trim()}”.`}
      />

      <div className="border-t border-soft-hairline px-3 py-2 font-mono text-sm text-faded-sumi">
        <span>↑↓ navigate</span>
        <span className="mx-2">·</span>
        <span>↵ select</span>
        <span className="mx-2">·</span>
        <span>Esc close</span>
      </div>
    </div>,
    document.body,
  )
}

// ─── Entry catalogue ────────────────────────────────────────────────────

type EntryGroup = 'Quality' | 'Pitch'

interface Entry {
  id:    string
  group: EntryGroup
  label: string
  hint?: string | undefined
  /** Free-text tokens used by the typeahead in addition to the label. */
  keywords: ReadonlyArray<string>
  /** True when this option already reflects the current state. */
  inactive?: boolean | undefined
  apply: (state: CardsFilterState) => CardsFilterState
}

function buildEntries(state: CardsFilterState): ReadonlyArray<Entry> {
  const entries: Entry[] = []

  const missingDims: ReadonlyArray<{ field: CardMissingField; label: string }> = [
    { field: 'pitch',    label: 'Missing pitch' },
    { field: 'picture',  label: 'Missing picture' },
    { field: 'mnemonic', label: 'Missing mnemonic' },
    { field: 'example',  label: 'Missing example' },
    { field: 'nuance',   label: 'Missing nuance' },
    { field: 'reading',  label: 'Missing reading' },
    { field: 'meaning',  label: 'Missing meaning' },
  ]
  for (const m of missingDims) {
    entries.push({
      id:       `missing:${m.field}`,
      group:    'Quality',
      label:    m.label,
      keywords: [m.field, 'missing', 'no'],
      inactive: state.missingField === m.field,
      apply:    (s) => ({ ...s, missingField: m.field }),
    })
  }

  const presentDims: ReadonlyArray<{ field: CardPresentField; label: string }> = [
    { field: 'pitch',   label: 'Has pitch' },
    { field: 'picture', label: 'Has picture' },
  ]
  for (const p of presentDims) {
    entries.push({
      id:       `has:${p.field}`,
      group:    'Quality',
      label:    p.label,
      keywords: [p.field, 'has', 'with'],
      inactive: state.presentField === p.field,
      apply:    (s) => {
        const next: CardsFilterState = { ...s, presentField: p.field }
        if (p.field !== 'pitch') next.pitchPattern = null
        return next
      },
    })
  }

  const patterns: ReadonlyArray<{ value: PitchPattern; label: string }> = [
    { value: 'heiban',    label: 'Pattern: Heiban' },
    { value: 'atamadaka', label: 'Pattern: Atamadaka' },
    { value: 'nakadaka',  label: 'Pattern: Nakadaka' },
    { value: 'odaka',     label: 'Pattern: Odaka' },
  ]
  for (const pat of patterns) {
    entries.push({
      id:       `pattern:${pat.value}`,
      group:    'Pitch',
      label:    pat.label,
      hint:     state.presentField === 'pitch' ? undefined : 'Also sets Has pitch',
      keywords: [pat.value, 'pitch', 'pattern'],
      inactive: state.pitchPattern === pat.value,
      apply:    (s) => ({ ...s, presentField: 'pitch', pitchPattern: pat.value }),
    })
  }

  // The 'Tag…' slot was removed per the audit-fix brief: it was
  // permanently disabled with a "Coming soon" hint, which presented as
  // design debt rather than a clear roadmap signal. When the tag-filter
  // backend lands, re-add a `tags:add` entry here that opens a tag
  // picker (not as a disabled placeholder).

  return entries
}

function filterEntries(entries: ReadonlyArray<Entry>, query: string): ReadonlyArray<Entry> {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return entries
  return entries.filter((e) => {
    if (e.label.toLowerCase().includes(q)) return true
    for (const kw of e.keywords) if (kw.toLowerCase().includes(q)) return true
    return false
  })
}
