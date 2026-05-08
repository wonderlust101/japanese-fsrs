'use client'

import { useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

import { Logo }              from '@/components/ui/Logo'
import { useMobileNavStore } from '@/stores/useMobileNavStore'

import { NAV_SECTIONS } from './nav-config'
import { NavItem }      from './nav-item'
import { NavSection }   from './nav-section'
import { UserMenu }     from './user-menu'

interface Props {
  user: User | null
}

/**
 * Mobile chrome (< lg breakpoint). Slide-in drawer from the left containing
 * the same section-grouped nav as the Sidebar. Triggered by the hamburger in
 * TopBar; closed by tapping the backdrop, the close button, the Escape key,
 * or any nav row (which closes before the route change).
 *
 * Renders unconditionally and uses `lg:hidden` + transform-based animation,
 * so the JSX is identical across breakpoints; CSS handles visibility.
 */
export function MobileDrawer({ user }: Props): React.JSX.Element {
  const isOpen    = useMobileNavStore((s) => s.isOpen)
  const close     = useMobileNavStore((s) => s.close)
  const drawerRef = useRef<HTMLDivElement>(null)

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

    const items = focusable()
    items[0]?.focus()

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
        aria-label="Main navigation"
        aria-hidden={!isOpen}
        className={[
          'lg:hidden fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] bg-cream-inset flex flex-col',
          'transform transition-transform duration-[250ms] ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-soft-hairline shrink-0">
          <Logo size={48} wordmarkSize="lg" />
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex items-center justify-center w-10 h-10 -mr-2 rounded-md text-sumi-ink hover:bg-soft-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors"
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Nav body */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((section) => (
            <NavSection key={section.label} label={section.label}>
              {section.items.map((item) => (
                <NavItem key={item.href} item={item} onNavigate={close} />
              ))}
            </NavSection>
          ))}
        </nav>

        {/* Account strip */}
        <div className="px-2 py-3 border-t border-soft-hairline shrink-0">
          <UserMenu user={user} onItemSelect={close} />
        </div>
      </div>
    </>
  )
}
