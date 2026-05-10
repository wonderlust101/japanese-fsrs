'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

/**
 * Dashboard chrome actions: the vermillion Add Card chip, the `?` glossary
 * trigger + popover, and the global keyboard-shortcut handler. All three are
 * co-located so the `?` keypress can directly toggle the panel state without
 * crossing component boundaries.
 *
 * Keyboard map (when focus is not in an input/textarea/contenteditable):
 *   S  → /review                (Start Review)
 *   L  → /review?mode=drill     (Drill leeches)
 *   C  → /review?mode=cram      (Cram a deck)
 *   A  → /decks/new             (Add card)
 *   ?  → toggle glossary panel
 *   Esc → close glossary panel
 */
export function DashboardActions(): React.JSX.Element {
  const router = useRouter()
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const toggleGlossary = useCallback(() => setGlossaryOpen((o) => !o), [])
  const closeGlossary  = useCallback(() => setGlossaryOpen(false), [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function handler(event: KeyboardEvent): void {
      // Skip if the user is typing into a field. Also skip when modifier keys
      // are held so we don't hijack browser shortcuts (Cmd+S, Ctrl+L etc.)
      const target = event.target as HTMLElement | null
      const inEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true
      if (inEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key) {
        case 's':
        case 'S':
          event.preventDefault()
          router.push('/review')
          break
        case 'l':
        case 'L':
          event.preventDefault()
          router.push('/review?mode=drill')
          break
        case 'c':
        case 'C':
          event.preventDefault()
          router.push('/review?mode=cram')
          break
        case 'a':
        case 'A':
          event.preventDefault()
          router.push('/decks/new')
          break
        case '?':
          event.preventDefault()
          toggleGlossary()
          break
        case 'Escape':
          if (glossaryOpen) {
            event.preventDefault()
            closeGlossary()
            triggerRef.current?.focus()
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, toggleGlossary, closeGlossary, glossaryOpen])

  // ── Click outside closes the glossary ──────────────────────────────────
  useEffect(() => {
    if (!glossaryOpen) return
    function handler(event: MouseEvent): void {
      const panel = document.getElementById(panelId)
      const trigger = triggerRef.current
      const target  = event.target as Node | null
      if (!target) return
      if (panel?.contains(target))   return
      if (trigger?.contains(target)) return
      closeGlossary()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [glossaryOpen, closeGlossary, panelId])

  return (
    <div className="flex items-center gap-2">
      {/* `?` glossary trigger */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleGlossary}
          aria-label="Open glossary"
          aria-expanded={glossaryOpen}
          aria-controls={panelId}
          className={[
            'inline-flex items-center justify-center w-10 h-10 rounded-[2px]',
            'font-mono text-sm font-medium text-faded-sumi',
            'border border-soft-hairline',
            'transition-colors duration-150 ease-out',
            'hover:bg-cream-inset hover:text-sumi-ink hover:border-faded-sumi',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          ?
        </button>

        {glossaryOpen && (
          <GlossaryPanel id={panelId} onClose={closeGlossary} />
        )}
      </div>

      {/* Add Card chip */}
      <Link
        href="/decks/new"
        className={[
          'inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[2px]',
          'bg-inari-vermillion text-warm-paper-raised',
          'text-sm font-medium',
          'transition-colors duration-150 ease-out',
          'hover:bg-inari-vermillion-deep',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        ].join(' ')}
      >
        <span className="font-mono text-base leading-none translate-y-[-1px]" aria-hidden="true">+</span>
        <span>Add card</span>
      </Link>
    </div>
  )
}

// ── Glossary panel ────────────────────────────────────────────────────────────

interface GlossaryEntry {
  term:    string
  meaning: string
}

const GLOSSARY: GlossaryEntry[] = [
  { term: 'Due',        meaning: 'A card the schedule says is ready to review today.' },
  { term: 'New',        meaning: 'A card you have not reviewed yet. New cards are always due.' },
  { term: 'Review',     meaning: 'A card already in your long-term schedule, returning for a check.' },
  { term: 'Lapse',      meaning: "A review you got wrong. The card resets to a shorter interval and goes through a relearning step." },
  { term: 'Leech',      meaning: 'A card you have lapsed many times (8 by default). Tomo flags it for focused drill so it stops draining your time.' },
  { term: 'Mastery',    meaning: 'The share of a deck’s cards you have graduated to long-term review.' },
  { term: 'Retention',  meaning: 'How often you remember a card correctly when it comes up. Tomo aims for around 85%.' },
  { term: 'Streak',     meaning: 'Consecutive days you have completed at least one review. Resets after a missed day.' },
  { term: 'JLPT',       meaning: 'Japanese-Language Proficiency Test. N5 is the easiest level, N1 is the hardest. “Beyond JLPT” covers vocabulary outside the official lists.' },
]

function GlossaryPanel({ id, onClose }: { id: string; onClose: () => void }): React.JSX.Element {
  return (
    <div
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label="Glossary"
      className={[
        // Anchored to the trigger; opens DOWN-LEFT so it sits inside the
        // viewport on the right edge of the TopBar without overflowing.
        'absolute top-full mt-2 right-0 z-50',
        'w-[min(420px,calc(100vw-2rem))]',
        'bg-warm-paper-raised',
        'border border-soft-hairline rounded-[2px]',
        'shadow-card',
        'p-6',
      ].join(' ')}
    >
      <header className="flex items-baseline justify-between mb-4 gap-4">
        <h2 className="flex items-baseline gap-3">
          <span
            lang="ja"
            aria-hidden="true"
            className="font-display text-xl text-inari-vermillion leading-none translate-y-[0.05em] select-none"
          >
            辞書
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
            Glossary
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close glossary"
          className={[
            'shrink-0 -my-1 -mr-1 px-2 py-1',
            'font-mono text-xs text-faded-sumi tracking-wide',
            'rounded-[2px] transition-colors duration-150 ease-out',
            'hover:bg-cream-inset hover:text-sumi-ink',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-1',
          ].join(' ')}
        >
          close
        </button>
      </header>
      <hr aria-hidden="true" className="border-0 border-t border-soft-hairline mb-4" />

      <dl className="space-y-3.5">
        {GLOSSARY.map((entry) => (
          <div key={entry.term} className="grid grid-cols-[5.5rem_1fr] gap-x-3">
            <dt className="font-mono text-xs uppercase tracking-[0.12em] text-sumi-ink pt-0.5">
              {entry.term}
            </dt>
            <dd className="text-sm text-faded-sumi leading-relaxed">
              {entry.meaning}
            </dd>
          </div>
        ))}
      </dl>

      <hr aria-hidden="true" className="border-0 border-t border-soft-hairline mt-5 mb-3" />
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        Shortcuts:
        <span className="ml-2 normal-case tracking-wide">
          <kbd className="font-mono">S</kbd> review,{' '}
          <kbd className="font-mono">L</kbd> drill,{' '}
          <kbd className="font-mono">C</kbd> cram,{' '}
          <kbd className="font-mono">A</kbd> add card,{' '}
          <kbd className="font-mono">?</kbd> this panel
        </span>
      </p>
    </div>
  )
}
