'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import {
  IconChevronRight,
  IconFlag,
  IconProfile,
  IconSettings,
  IconSignOut,
} from '@/components/icons/chrome-marks'
import { signOutAction }      from '@/lib/actions/auth.actions'
import { getUserDisplayName } from '@/lib/supabase/user-metadata'

interface Props {
  user: User | null
  /** Optional callback fired after the user picks any item or signs out.
   *  The MobileDrawer passes its `close` action so the drawer collapses
   *  before the route change takes effect. */
  onItemSelect?: () => void
}

const NOOP = (): void => {}

/**
 * The account-strip control that lives at the bottom of every chrome surface
 * (Sidebar and MobileDrawer). The trigger button shows the user's initial
 * badge and display name; tapping it opens a popover with Profile, Settings,
 * Report a bug, and Sign out. Click outside or Escape closes.
 *
 * Icons are the geometric ink-stroke set from `@/components/icons`, sized at
 * 16px in the popover so they read as quiet leading marks beside the labels.
 * On the trigger row the avatar disc replaces a leading icon — the initial
 * carries identity at this position.
 */
export function UserMenu({ user, onItemSelect = NOOP }: Props): React.JSX.Element {
  const router       = useRouter()
  const queryClient  = useQueryClient()
  const wrapperRef   = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Click outside closes the menu.
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(e: MouseEvent | TouchEvent): void {
      const wrapper = wrapperRef.current
      if (wrapper === null) return
      if (!wrapper.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  // Escape closes the menu.
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  const displayLabel = getUserDisplayName(user) ?? user?.email ?? 'User'
  const initial      = displayLabel[0]?.toUpperCase() ?? '?'

  function handleItemClick(): void {
    setIsOpen(false)
    onItemSelect()
  }

  async function handleSignOut(): Promise<void> {
    setIsOpen(false)
    onItemSelect()
    await signOutAction()
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }

  const itemClass        = 'flex items-center gap-3 px-3 py-2 rounded-[2px] text-sm font-medium text-sumi-ink hover:bg-cream-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors text-left w-full'
  const destructiveClass = 'flex items-center gap-3 px-3 py-2 rounded-[2px] text-sm font-medium text-inari-vermillion-deep hover:bg-vermillion-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors text-left w-full'

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-[2px] text-base font-medium text-sumi-ink hover:bg-cream-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vermillion-wash text-xs font-bold text-inari-vermillion"
        >
          {initial}
        </span>
        <span className="truncate flex-1 text-left">{displayLabel}</span>
        <IconChevronRight
          aria-hidden="true"
          className={`shrink-0 w-4 h-4 text-faded-sumi transition-transform duration-[200ms] ease-out ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Account options"
          className="absolute bottom-full left-0 right-0 mb-2 bg-warm-paper-raised rounded-[2px] border border-soft-hairline shadow-card p-1 flex flex-col animate-page-enter"
        >
          <Link href="/settings/profile" role="menuitem" onClick={handleItemClick} className={itemClass}>
            <IconProfile className="shrink-0 w-4 h-4 text-faded-sumi" />
            <span className="flex-1">Profile</span>
          </Link>
          <Link href="/settings" role="menuitem" onClick={handleItemClick} className={itemClass}>
            <IconSettings className="shrink-0 w-4 h-4 text-faded-sumi" />
            <span className="flex-1">Settings</span>
          </Link>
          <Link href="/report-bug" role="menuitem" onClick={handleItemClick} className={itemClass}>
            <IconFlag className="shrink-0 w-4 h-4 text-faded-sumi" />
            <span className="flex-1">Report a bug</span>
          </Link>
          <div className="my-1 mx-2 h-px bg-soft-hairline" aria-hidden="true" />
          <button type="button" role="menuitem" onClick={handleSignOut} className={destructiveClass}>
            <IconSignOut className="shrink-0 w-4 h-4" />
            <span className="flex-1">Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
