import type { User } from '@supabase/supabase-js'

import { Logo } from '@/components/ui/Logo'

import { NAV_SECTIONS } from './nav-config'
import { NavItem }      from './nav-item'
import { NavSection }   from './nav-section'
import { UserMenu }     from './user-menu'

interface Props {
  user: User | null
}

/**
 * Desktop chrome (≥ lg breakpoint). 288px column with a brand strip on top,
 * section-grouped nav body in the middle, and the UserMenu account strip on
 * the bottom. Hidden on mobile; the MobileDrawer covers the same surfaces
 * under lg.
 */
export function Sidebar({ user }: Props): React.JSX.Element {
  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 h-screen bg-cream-inset border-r border-soft-hairline">
      {/* Brand strip */}
      <div className="flex items-center h-16 px-4 border-b border-soft-hairline shrink-0">
        <Logo size={48} wordmarkSize="lg" />
      </div>

      {/* Nav body */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map((section) => (
          <NavSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </NavSection>
        ))}
      </nav>

      {/* Account strip */}
      <div className="px-2 py-3 border-t border-soft-hairline shrink-0">
        <UserMenu user={user} />
      </div>
    </aside>
  )
}
