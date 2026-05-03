'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Library, BookOpen, BarChart2, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { signOutAction } from '@/lib/actions/auth.actions'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/decks',     label: 'Decks',     Icon: Library },
  { href: '/review',    label: 'Review',    Icon: BookOpen },
  { href: '/analytics', label: 'Analytics', Icon: BarChart2 },
]

function NavLink({ href, label, Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
        active
          ? 'bg-accent-bg text-accent'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </Link>
  )
}

export function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()

  async function handleSignOut() {
    await signOutAction()
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }

  const fullName = user?.user_metadata?.['full_name'] as string | undefined
  const displayLabel = fullName ?? user?.email ?? 'User'
  const initial = displayLabel[0]?.toUpperCase() ?? '?'

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen bg-neutral-0 border-r border-neutral-200">
      {/* Logo */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-neutral-200 shrink-0">
        <span className="text-xl font-bold text-primary-600">友日</span>
        <span className="text-sm font-medium text-neutral-700">FSRS Japanese</span>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
          />
        ))}
      </nav>

      {/* Settings + user */}
      <div className="px-2 py-3 border-t border-neutral-200 space-y-0.5 shrink-0">
        <NavLink
          href="/settings"
          label="Settings"
          Icon={Settings}
          active={pathname.startsWith('/settings')}
        />

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          <span
            aria-hidden="true"
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700"
          >
            {initial}
          </span>
          <span className="truncate">{displayLabel}</span>
        </button>
      </div>
    </aside>
  )
}
