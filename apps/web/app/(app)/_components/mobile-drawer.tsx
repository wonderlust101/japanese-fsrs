'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

import { IconClose } from '@/components/icons/chrome-marks'

import { Logo }              from '@/components/ui/Logo'
import { useDueCards }       from '@/lib/api/reviews'
import { useMobileNavStore } from '@/stores/useMobileNavStore'

import { AddCardCta }           from './add-card-cta'
import { NAV_SECTIONS }         from './nav-config'
import { NavItem, WeakSpotCountNavItem } from './nav-item'
import { NavSection }           from './nav-section'
import { UserMenu }             from './user-menu'

interface Props {
  user: User | null
}

const MIN_PER_CARD = 0.5

/**
 * Mobile chrome (< lg breakpoint). Slide-in drawer from the left with the
 * V5.1 design: brand strip + bilingual today strip + kanji-led nav sections
 * + Help row (mobile variant) + UserMenu.
 *
 * Triggered by the hamburger in TopBar; closed by tapping the backdrop, the
 * close button, the Escape key, or any nav row (which closes before the
 * route change).
 */
export function MobileDrawer({ user }: Props): React.JSX.Element {
  const isOpen         = useMobileNavStore((s) => s.isOpen)
  const close          = useMobileNavStore((s) => s.close)
  const drawerRef      = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Body scroll lock while open.
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  // Focus trap, escape-to-close, focus first interactive on open.
  useEffect(() => {
    if (!isOpen) return
    const drawer = drawerRef.current
    if (drawer === null) return

    const focusable = (): HTMLElement[] =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      )

    // Land initial focus on the close button rather than the first focusable
    // element. The first focusable is the brand link (which navigates to
    // /today on Enter); auto-focusing it means a user who opens the drawer
    // intending to browse navigation could accidentally route away with a
    // single Enter keystroke. The close button is the safe default.
    if (closeButtonRef.current !== null) {
      closeButtonRef.current.focus()
    } else {
      focusable()[0]?.focus()
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const ring = focusable()
      const first = ring[0]
      const last  = ring[ring.length - 1]
      if (first === undefined || last === undefined) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close])

  // Reviews row microcopy: real due-cards query.
  const dueCardsQuery = useDueCards()
  const dueCount      = dueCardsQuery.data?.items.length ?? 0
  const reviewsSubLabel = dueCount > 0
    ? `${dueCount} card${dueCount === 1 ? '' : 's'} · ~${Math.max(1, Math.ceil(dueCount * MIN_PER_CARD))} min`
    : undefined

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={[
          'lg:hidden fixed inset-0 z-40 bg-sumi-ink/40 transition-opacity duration-[250ms] ease-out',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!isOpen}
        className={[
          'lg:hidden fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] bg-warm-paper-raised flex flex-col',
          'transform transition-transform duration-[250ms] ease-out',
          'border-r border-soft-hairline',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Top vermillion hairline rule */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-inari-vermillion/60 z-20"
        />

        {/* Drawer header */}
        <div className="relative flex items-center justify-between h-16 px-4 border-b border-soft-hairline shrink-0">
          <Link
            href="/today"
            aria-label="Go to Reviews"
            onClick={close}
            className="rounded-[2px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            <Logo size={48} wordmarkSize="lg" priority />
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex items-center justify-center w-11 h-11 -mr-2 rounded-[2px] text-sumi-ink hover:bg-cream-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 transition-colors"
          >
            <IconClose aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>

        {/* Primary CTA — sits between brand bar and section nav. The
            today strip is desktop-only; on tablet and mobile the date
            wasn't earning its vertical real estate inside the drawer. */}
        <div className="shrink-0 border-b border-soft-hairline">
          <AddCardCta onNavigate={close} />
        </div>

        {/* Nav body */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((section, index) => (
            <NavSection
              key={section.label}
              label={section.label}
              kanji={section.kanji}
              isFirst={index === 0}
            >
              {section.items.map((item) => {
                // Dispatch weak-spots rows to the count-aware wrapper so
                // mobile parity matches desktop sidebar.
                const Renderer = item.hasWeakSpotCount === true ? WeakSpotCountNavItem : NavItem
                return (
                  <Renderer
                    key={item.href}
                    item={item}
                    onNavigate={close}
                    {...(item.hasDueCount === true && reviewsSubLabel !== undefined
                      ? { subLabel: reviewsSubLabel }
                      : {})}
                  />
                )
              })}
            </NavSection>
          ))}
        </nav>

        {/* Account strip — Help moved into this menu so the drawer keeps
            only navigation + account, with secondary actions tucked away. */}
        <div className="px-2 py-3 border-t border-soft-hairline shrink-0">
          <UserMenu user={user} onItemSelect={close} />
        </div>
      </div>
    </>
  )
}
