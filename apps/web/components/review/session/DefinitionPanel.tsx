'use client'

import { useEffect } from 'react'

import {
  useSessionPreferences,
  useSessionPreferencesActions,
} from '@/stores/useSessionPreferencesStore'
import { cn } from '@/lib/utils'

export interface KanjiBreakdownEntry {
  kanji:    string
  radical:  string
  meaning?: string
  reading?: string
}

interface DefinitionPanelProps {
  nuance?:         string | null
  mnemonic?:       string | null
  kanjiBreakdown?: KanjiBreakdownEntry[]
  /**
   * When true, the panel installs its own keydown listener so the per-tab
   * shortcut hints (N / M / K) actually switch tabs. Default false:
   * during a review session, `ReviewCard` owns the keyboard (rating, flip,
   * undo, teach sheet) and drives the same tabs, so the panel must NOT also
   * listen or the keys would double-fire. On standalone surfaces that render
   * `CardBack` without `ReviewCard` (e.g. the card-detail page), there is no
   * external authority, so the panel takes the keys itself.
   */
  manageShortcuts?: boolean
}

interface Tab {
  id:        string
  label:     string
  shortcut?: string
  render:    () => React.JSX.Element
}

// Tabs-only study-notes panel (v4). The primary meaning now lives in
// WordStack tightly bonded to the kanji; this panel surfaces additional
// facets only when the card has content for them. Nuance leads the strip
// (per direction) and is the AI-authored prose explanation of register and
// connotation.
//
// If no tabs render (none of the optional content is present), the panel
// returns null so the card body doesn't carry an empty section.

export function DefinitionPanel({
  nuance,
  mnemonic,
  kanjiBreakdown,
  manageShortcuts = false,
}: DefinitionPanelProps): React.JSX.Element | null {
  const prefs   = useSessionPreferences()
  const actions = useSessionPreferencesActions()

  const tabs: Tab[] = []

  if (nuance !== null && nuance !== undefined && nuance !== '') {
    tabs.push({
      id:    'nuance',
      label: 'Nuance',
      shortcut: 'N',
      render: () => (
        <p className="text-base md:text-lg leading-relaxed text-sumi-ink max-w-measure">
          {nuance}
        </p>
      ),
    })
  }

  if (mnemonic !== null && mnemonic !== undefined && mnemonic !== '') {
    tabs.push({
      id:    'mnemonic',
      label: 'Mnemonic',
      shortcut: 'M',
      render: () => (
        <p className="text-base md:text-lg leading-relaxed text-sumi-ink max-w-measure">
          {mnemonic}
        </p>
      ),
    })
  }

  if (kanjiBreakdown !== undefined && kanjiBreakdown.length > 0) {
    tabs.push({
      id:    'kanji',
      label: 'Kanji',
      shortcut: 'K',
      render: () => (
        <ul className="flex flex-col gap-3">
          {kanjiBreakdown.map((k, i) => (
            <li key={`${k.kanji}-${i}`} className="flex items-baseline gap-4 max-w-measure">
              <span lang="ja" className="font-japanese text-2xl text-sumi-ink leading-none w-10 shrink-0">{k.kanji}</span>
              <div className="flex-1 leading-relaxed">
                {k.reading !== undefined && k.reading !== '' && (
                  <span lang="ja" className="font-japanese text-faded-sumi mr-2">{k.reading}</span>
                )}
                {k.meaning !== undefined && k.meaning !== '' && (
                  <span className="text-sumi-ink">{k.meaning}</span>
                )}
                {k.radical !== '' && (
                  <span className="block font-mono text-sm text-faded-sumi/80 mt-0.5">
                    Radical · {k.radical}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ),
    })
  }

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === prefs.activeDefTab))
  const activeTab   = tabs[activeIndex] ?? tabs[0]
  const activeId    = activeTab?.id ?? ''

  const tabsFingerprint = tabs.map((t) => t.id).join('|')

  useEffect(() => {
    if (tabs.length === 0) return
    if (!tabsFingerprint.split('|').includes(prefs.activeDefTab)) {
      const first = tabs[0]
      if (first !== undefined) actions.setActiveDefTab(first.id)
    }
  }, [tabsFingerprint, prefs.activeDefTab, actions, tabs])

  // ── Tab-switching shortcuts (opt-in via `manageShortcuts`). ──────────
  // Built from the live `tabs` array, so only tabs that actually rendered
  // respond and the binding can never drift from the displayed hints. A
  // letter selects its tab; pressing the active tab's letter again toggles
  // back to the first tab (matching the in-review "press to dismiss" feel).
  useEffect(() => {
    if (!manageShortcuts || tabs.length === 0) return

    const letterToId = new Map<string, string>()
    for (const t of tabs) {
      if (t.shortcut !== undefined) letterToId.set(t.shortcut.toLowerCase(), t.id)
    }
    const firstId = tabs[0]?.id

    function handleKey(e: KeyboardEvent): void {
      // Ignore shifted keys too: Shift+letter is reserved for page-level
      // shortcuts (e.g. the card-detail page's Shift+M opens the memory
      // popup), so a bare-letter tab toggle must not also fire.
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      // A confirm/move dialog (native <dialog>) is open above the card: let
      // it own the keyboard rather than switching tabs behind the backdrop.
      if (typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null) return

      const targetId = letterToId.get(e.key.toLowerCase())
      if (targetId === undefined) return
      e.preventDefault()
      const next = prefs.activeDefTab === targetId && firstId !== undefined ? firstId : targetId
      actions.setActiveDefTab(next)
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [manageShortcuts, tabsFingerprint, prefs.activeDefTab, actions, tabs])

  if (tabs.length === 0 || activeTab === undefined) return null

  return (
    <section aria-label="Study notes" className="flex w-full flex-col gap-4">
      <div role="tablist" aria-label="Study notes tabs" className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-soft-hairline/55 pb-2">
        {tabs.map((t) => {
          const selected = t.id === activeId
          return (
            <button
              key={t.id}
              id={`def-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`def-panel-${t.id}`}
              {...(t.shortcut !== undefined ? { 'aria-keyshortcuts': t.shortcut.toLowerCase() } : {})}
              tabIndex={selected ? 0 : -1}
              onClick={() => actions.setActiveDefTab(t.id)}
              className={cn(
                'inline-flex items-baseline gap-2 py-1 cursor-pointer',
                'font-display text-sm font-medium',
                'transition-colors duration-100',
                selected
                  ? 'text-sumi-ink relative after:absolute after:inset-x-0 after:-bottom-[9px] after:h-px after:bg-sumi-ink'
                  : 'text-faded-sumi hover:text-sumi-ink',
                'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              )}
            >
              {t.label}
              {t.shortcut !== undefined && (
                <kbd className={cn(
                  'font-mono text-sm px-1 py-px rounded border border-soft-hairline',
                  'max-md:hidden',
                  selected ? 'text-faded-sumi border-sumi-ink/25' : 'text-faded-sumi/65',
                )}>
                  {t.shortcut}
                </kbd>
              )}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`def-panel-${activeId}`}
        aria-labelledby={`def-tab-${activeId}`}
        tabIndex={0}
        className="pt-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        {activeTab.render()}
      </div>
    </section>
  )
}
