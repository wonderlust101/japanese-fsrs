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
  collocations?:   string[]
  homophones?:     string[]
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
  collocations,
  homophones,
}: DefinitionPanelProps): React.JSX.Element | null {
  const prefs   = useSessionPreferences()
  const actions = useSessionPreferencesActions()

  const tabs: Tab[] = []

  if (nuance !== null && nuance !== undefined && nuance !== '') {
    tabs.push({
      id:    'nuance',
      label: 'Nuance',
      render: () => (
        <p className="font-serif text-base md:text-lg leading-relaxed text-sumi-ink max-w-[65ch]">
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
        <p className="font-serif text-base md:text-lg leading-relaxed text-sumi-ink max-w-[65ch]">
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
            <li key={`${k.kanji}-${i}`} className="flex items-baseline gap-4 max-w-[65ch]">
              <span lang="ja" className="font-japanese text-2xl text-sumi-ink leading-none w-10 shrink-0">{k.kanji}</span>
              <div className="flex-1 leading-relaxed">
                {k.reading !== undefined && k.reading !== '' && (
                  <span lang="ja" className="font-japanese text-faded-sumi mr-2">{k.reading}</span>
                )}
                {k.meaning !== undefined && k.meaning !== '' && (
                  <span className="text-sumi-ink">{k.meaning}</span>
                )}
                {k.radical !== '' && (
                  <span className="block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi/80 mt-0.5">
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

  if (collocations !== undefined && collocations.length > 0) {
    tabs.push({
      id:    'collocations',
      label: 'Collocations',
      render: () => (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5 max-w-[65ch]">
          {collocations.map((c, i) => (
            <li key={`${c}-${i}`} lang="ja" className="font-japanese text-sumi-ink/90 text-base md:text-lg">
              {c}
            </li>
          ))}
        </ul>
      ),
    })
  }

  if (homophones !== undefined && homophones.length > 0) {
    tabs.push({
      id:    'homophones',
      label: 'Homophones',
      render: () => (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5 max-w-[65ch]">
          {homophones.map((h, i) => (
            <li key={`${h}-${i}`} lang="ja" className="font-japanese text-sumi-ink/90 text-base md:text-lg">
              {h}
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

  if (tabs.length === 0 || activeTab === undefined) return null

  return (
    <section aria-label="Study notes" className="flex w-full flex-col gap-4">
      <div role="tablist" aria-label="Study notes tabs" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-soft-hairline/55 pb-2">
        {tabs.map((t) => {
          const selected = t.id === activeId
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => actions.setActiveDefTab(t.id)}
              className={cn(
                'inline-flex items-baseline gap-2 py-1 cursor-pointer',
                'font-mono text-[0.6875rem] uppercase tracking-[0.16em]',
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
                  'font-mono text-[0.55rem] uppercase tracking-[0.12em] px-1 py-px rounded border border-soft-hairline',
                  selected ? 'text-faded-sumi border-sumi-ink/25' : 'text-faded-sumi/65',
                )}>
                  {t.shortcut}
                </kbd>
              )}
            </button>
          )
        })}
      </div>

      <div className="pt-1">{activeTab.render()}</div>
    </section>
  )
}
